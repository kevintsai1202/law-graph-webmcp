package tw.lawgraph.api;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** 驗證 PDF、Markdown、DOCX 上傳並抽取可送入案件分析的純文字。 */
@Component
public class CaseFileExtractor {
    /** 單一已解析檔案；只保留安全檔名與純文字，不持久化原始 bytes。 */
    public record ExtractedFile(String filename, String text) {}

    private final int maxFiles;
    private final long maxFileBytes;
    private final int maxExtractedChars;
    private final int maxVisionPages;
    private final float visionRenderDpi;
    private final PdfPageVisionReader visionReader;

    /** 由設定注入檔案數、單檔大小及總抽取字數限制。 */
    @Autowired
    public CaseFileExtractor(@Value("${lawgraph.uploads.max-files:5}") int maxFiles,
                             @Value("${lawgraph.uploads.max-file-bytes:10485760}") long maxFileBytes,
                             @Value("${lawgraph.uploads.max-extracted-chars:60000}") int maxExtractedChars,
                             @Value("${lawgraph.uploads.max-vision-pages:20}") int maxVisionPages,
                             @Value("${lawgraph.uploads.vision-render-dpi:144}") float visionRenderDpi,
                             PdfPageVisionReader visionReader) {
        this.maxFiles = maxFiles;
        this.maxFileBytes = maxFileBytes;
        this.maxExtractedChars = maxExtractedChars;
        this.maxVisionPages = maxVisionPages;
        this.visionRenderDpi = visionRenderDpi;
        this.visionReader = visionReader;
    }

    /** 提供單元測試及純文字附件測試使用的建構方式。 */
    CaseFileExtractor(int maxFiles, long maxFileBytes, int maxExtractedChars) {
        this(maxFiles, maxFileBytes, maxExtractedChars, 20, 144,
                (filename, pageNumber, pngBytes) -> { throw new IllegalStateException("vision reader is unavailable"); });
    }

    /** 驗證並解析全部附件；任一檔案失敗時整個請求失敗，避免靜默漏讀證據。 */
    public List<ExtractedFile> extract(List<MultipartFile> files) {
        List<MultipartFile> supplied = files == null ? List.of() : files.stream().filter(file -> !file.isEmpty()).toList();
        if (supplied.size() > maxFiles) {
            throw new InvalidAttachmentException("TOO_MANY_FILES", "at most " + maxFiles + " files are allowed");
        }
        List<ExtractedFile> extracted = new ArrayList<>();
        int totalChars = 0;
        for (MultipartFile file : supplied) {
            if (file.getSize() > maxFileBytes) {
                throw new InvalidAttachmentException("FILE_TOO_LARGE", safeName(file) + " exceeds the per-file size limit");
            }
            String name = safeName(file);
            String extension = extension(name);
            byte[] bytes = read(file);
            String text = switch (extension) {
                case "pdf" -> extractPdf(name, bytes);
                case "md", "markdown" -> extractMarkdown(name, bytes);
                case "docx" -> extractDocx(name, bytes);
                default -> throw new InvalidAttachmentException("UNSUPPORTED_FILE_TYPE", name + " must be PDF, MD, or DOCX");
            };
            text = normalize(text);
            if (text.isBlank()) {
                throw new InvalidAttachmentException("NO_EXTRACTABLE_TEXT", name + " contains no extractable text; scanned PDFs require OCR before upload");
            }
            totalChars += text.length();
            if (totalChars > maxExtractedChars) {
                throw new InvalidAttachmentException("EXTRACTED_TEXT_TOO_LARGE", "extracted text exceeds " + maxExtractedChars + " characters");
            }
            extracted.add(new ExtractedFile(name, text));
        }
        return List.copyOf(extracted);
    }

    /** 將使用者描述與附件文字組成有清楚資料邊界的案件輸入。 */
    public String composeCaseText(String caseText, List<ExtractedFile> files) {
        StringBuilder composed = new StringBuilder();
        String description = caseText == null ? "" : caseText.trim();
        if (!description.isEmpty()) composed.append("[USER_CASE_DESCRIPTION]\n").append(description).append("\n[/USER_CASE_DESCRIPTION]");
        for (ExtractedFile file : files) {
            if (!composed.isEmpty()) composed.append("\n\n");
            composed.append("[UPLOADED_DOCUMENT filename=\"").append(file.filename()).append("\"]\n")
                    .append(file.text()).append("\n[/UPLOADED_DOCUMENT]");
        }
        return composed.toString();
    }

    /** 讀取 MultipartFile bytes 並轉成一致錯誤。 */
    private static byte[] read(MultipartFile file) {
        try { return file.getBytes(); }
        catch (IOException exception) { throw new InvalidAttachmentException("FILE_READ_FAILED", safeName(file) + " could not be read"); }
    }

    /** 逐頁抽取 PDF；僅將沒有文字層的頁面渲染後交給視覺模型轉錄。 */
    private String extractPdf(String name, byte[] bytes) {
        if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') {
            throw new InvalidAttachmentException("FILE_TYPE_MISMATCH", name + " is not a valid PDF");
        }
        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) throw new InvalidAttachmentException("ENCRYPTED_FILE", name + " is encrypted");
            PDFTextStripper stripper = new PDFTextStripper();
            PDFRenderer renderer = new PDFRenderer(document);
            StringBuilder result = new StringBuilder();
            int visionPages = 0;
            for (int pageIndex = 0; pageIndex < document.getNumberOfPages(); pageIndex++) {
                int pageNumber = pageIndex + 1;
                stripper.setStartPage(pageNumber);
                stripper.setEndPage(pageNumber);
                String pageText = normalize(stripper.getText(document));
                if (!pageText.isBlank()) {
                    appendPdfPage(result, pageNumber, "text", false, pageText);
                    continue;
                }
                visionPages++;
                if (visionPages > maxVisionPages) {
                    throw new InvalidAttachmentException("TOO_MANY_SCANNED_PAGES",
                            name + " exceeds the " + maxVisionPages + " scanned-page limit");
                }
                byte[] pngBytes = renderPage(renderer, pageIndex, name);
                try {
                    String transcription = normalize(visionReader.transcribe(name, pageNumber, pngBytes));
                    appendPdfPage(result, pageNumber, "vision", true, transcription);
                } catch (InvalidAttachmentException exception) {
                    throw exception;
                } catch (RuntimeException exception) {
                    throw new InvalidAttachmentException("VISION_ANALYSIS_FAILED",
                            name + " page " + pageNumber + " could not be analyzed by the vision model");
                }
            }
            return result.toString();
        } catch (InvalidAttachmentException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new InvalidAttachmentException("FILE_PARSE_FAILED", name + " could not be parsed as PDF");
        }
    }

    /** 將 PDF 頁面渲染成記憶體內 PNG，不將影像寫入磁碟。 */
    private byte[] renderPage(PDFRenderer renderer, int pageIndex, String name) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var image = renderer.renderImageWithDPI(pageIndex, visionRenderDpi, ImageType.RGB);
            if (!ImageIO.write(image, "png", output)) {
                throw new IOException("PNG writer unavailable");
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new InvalidAttachmentException("FILE_PARSE_FAILED", name + " page " + (pageIndex + 1) + " could not be rendered");
        }
    }

    /** 加入帶來源、頁碼與人工核對屬性的 PDF 頁面邊界。 */
    private static void appendPdfPage(StringBuilder target, int pageNumber, String source,
                                      boolean requiresReview, String text) {
        target.append("[PDF_PAGE number=\"").append(pageNumber).append("\" source=\"").append(source)
                .append("\" requires_review=\"").append(requiresReview).append("\"]\n")
                .append(text).append("\n[/PDF_PAGE]\n");
    }

    /** 以嚴格 UTF-8 解碼 Markdown，避免以系統預設編碼誤讀內容。 */
    private static String extractMarkdown(String name, byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException exception) {
            throw new InvalidAttachmentException("INVALID_TEXT_ENCODING", name + " must use UTF-8 encoding");
        }
    }

    /** 抽取 DOCX 段落與表格文字；拒絕只改副檔名的非 ZIP 檔案。 */
    private static String extractDocx(String name, byte[] bytes) {
        if (bytes.length < 4 || bytes[0] != 'P' || bytes[1] != 'K') {
            throw new InvalidAttachmentException("FILE_TYPE_MISMATCH", name + " is not a valid DOCX");
        }
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            StringBuilder text = new StringBuilder();
            document.getParagraphs().forEach(paragraph -> appendLine(text, paragraph.getText()));
            for (XWPFTable table : document.getTables()) {
                table.getRows().forEach(row -> appendLine(text, row.getTableCells().stream()
                        .map(cell -> cell.getText().trim()).filter(value -> !value.isEmpty()).reduce((a, b) -> a + "\t" + b).orElse("")));
            }
            return text.toString();
        } catch (IOException | RuntimeException exception) {
            throw new InvalidAttachmentException("FILE_PARSE_FAILED", name + " could not be parsed as DOCX");
        }
    }

    /** 將非空白內容以一行加入抽取結果。 */
    private static void appendLine(StringBuilder target, String value) {
        if (value != null && !value.isBlank()) target.append(value.trim()).append('\n');
    }

    /** 正規化換行並移除控制字元，保留 tab 與換行供表格閱讀。 */
    private static String normalize(String text) {
        return text.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("[\\p{Cc}&&[^\\n\\t]]", "").trim();
    }

    /** 只保留路徑最後一段，避免把用戶端本機路徑送入分析。 */
    private static String safeName(MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename();
        String normalized = original.replace('\\', '/');
        String name = normalized.substring(normalized.lastIndexOf('/') + 1).trim();
        return name.isEmpty() ? "upload" : name.replace('"', '_');
    }

    /** 取得小寫副檔名；沒有副檔名時回空字串。 */
    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
