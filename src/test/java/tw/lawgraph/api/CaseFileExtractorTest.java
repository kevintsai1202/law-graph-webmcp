package tw.lawgraph.api;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 附件解析器需涵蓋三種允許格式、資料邊界及拒絕路徑。 */
class CaseFileExtractorTest {
    private final CaseFileExtractor extractor = new CaseFileExtractor(5, 10_000_000, 60_000);

    /** Markdown 以 UTF-8 原文抽取並去除用戶端路徑。 */
    @Test void extractsMarkdownAndSanitizesFilename() {
        var file = new MockMultipartFile("files", "C:\\secret\\facts.md", "text/markdown", "# 事實\n已付款".getBytes(StandardCharsets.UTF_8));
        var result = extractor.extract(List.of(file));
        assertEquals("facts.md", result.getFirst().filename());
        assertEquals("# 事實\n已付款", result.getFirst().text());
    }

    /** 文字型 PDF 可抽取內容。 */
    @Test void extractsTextPdf() throws Exception {
        byte[] bytes;
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            var page = new PDPage(); document.addPage(page);
            try (var content = new PDPageContentStream(document, page)) {
                content.beginText(); content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(72, 700); content.showText("Payment on 2026-09-01"); content.endText();
            }
            document.save(output); bytes = output.toByteArray();
        }
        var result = extractor.extract(List.of(new MockMultipartFile("files", "evidence.pdf", "application/pdf", bytes)));
        assertTrue(result.getFirst().text().contains("Payment on 2026-09-01"));
        assertTrue(result.getFirst().text().contains("source=\"text\""));
    }

    /** 無文字層頁面只交給視覺轉錄器，並標出頁碼與人工核對需求。 */
    @Test void transcribesScannedPdfPageWithReviewMarker() throws Exception {
        byte[] bytes = blankPdf(1);
        AtomicInteger calls = new AtomicInteger();
        var visionExtractor = new CaseFileExtractor(5, 10_000_000, 60_000, 20, 72,
                (filename, pageNumber, pngBytes) -> {
                    calls.incrementAndGet();
                    assertEquals("scan.pdf", filename);
                    assertEquals(1, pageNumber);
                    assertTrue(pngBytes.length > 0);
                    return "付款日期：[無法辨識]";
                });

        String text = visionExtractor.extract(List.of(new MockMultipartFile(
                "files", "scan.pdf", "application/pdf", bytes))).getFirst().text();

        assertEquals(1, calls.get());
        assertTrue(text.contains("source=\"vision\" requires_review=\"true\""));
        assertTrue(text.contains("付款日期：[無法辨識]"));
    }

    /** 掃描頁超過限制時停止處理，避免無上限的模型成本。 */
    @Test void rejectsPdfExceedingScannedPageLimit() throws Exception {
        byte[] bytes = blankPdf(2);
        var visionExtractor = new CaseFileExtractor(5, 10_000_000, 60_000, 1, 72,
                (filename, pageNumber, pngBytes) -> "第 " + pageNumber + " 頁");

        var error = assertThrows(InvalidAttachmentException.class, () -> visionExtractor.extract(List.of(
                new MockMultipartFile("files", "scan.pdf", "application/pdf", bytes))));

        assertEquals("TOO_MANY_SCANNED_PAGES", error.code());
    }

    /** DOCX 段落可抽取內容。 */
    @Test void extractsDocxParagraphs() throws Exception {
        byte[] bytes;
        try (var document = new XWPFDocument(); var output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("租約於九月終止");
            document.write(output); bytes = output.toByteArray();
        }
        var result = extractor.extract(List.of(new MockMultipartFile("files", "contract.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes)));
        assertEquals("租約於九月終止", result.getFirst().text());
    }

    /** 組合後必須明確標出使用者描述與不可信附件範圍。 */
    @Test void composesExplicitSourceBoundaries() {
        String result = extractor.composeCaseText("我的說明", List.of(new CaseFileExtractor.ExtractedFile("facts.md", "附件內容")));
        assertTrue(result.contains("[USER_CASE_DESCRIPTION]"));
        assertTrue(result.contains("[UPLOADED_DOCUMENT filename=\"facts.md\"]"));
    }

    /** 不支援的副檔名需明確拒絕。 */
    @Test void rejectsUnsupportedFile() {
        var error = assertThrows(InvalidAttachmentException.class, () -> extractor.extract(List.of(
                new MockMultipartFile("files", "facts.txt", "text/plain", "x".getBytes(StandardCharsets.UTF_8)))));
        assertEquals("UNSUPPORTED_FILE_TYPE", error.code());
    }

    /** 建立指定頁數的無文字 PDF，模擬純圖片掃描檔的路由條件。 */
    private static byte[] blankPdf(int pages) throws Exception {
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            for (int index = 0; index < pages; index++) document.addPage(new PDPage());
            document.save(output);
            return output.toByteArray();
        }
    }
}
