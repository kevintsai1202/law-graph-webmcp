package tw.lawgraph.api;

import com.embabel.agent.spi.LlmService;
import com.embabel.agent.spi.support.springai.SpringAiLlmService;
import com.embabel.common.ai.model.ModelProvider;
import com.embabel.common.ai.model.ModelSelectionCriteria;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;

/** 使用既有 Spring AI 視覺模型忠實轉錄掃描式 PDF 頁面。 */
@Component
public class SpringAiPdfPageVisionReader implements PdfPageVisionReader {
    private static final String TRANSCRIPTION_PROMPT = """
            你是文件影像轉錄器，只能忠實抄錄圖片中實際可見的文字，不進行法律分析。
            保留原有閱讀順序、段落、日期、金額、人名及編號；表格可用純文字分欄表示。
            不得依上下文猜測、修正或補全。任何模糊文字、手寫、印章或簽名一律標成 [無法辨識]。
            只輸出轉錄結果，不要加入說明、摘要或 Markdown 程式碼框。
            """;

    private final ChatClient chatClient;

    /** 使用應用程式既有模型設定建立可重用的聊天用戶端。 */
    public SpringAiPdfPageVisionReader(ModelProvider modelProvider) {
        LlmService<?> selectedModel = modelProvider.getLlm(ModelSelectionCriteria.getPlatformDefault());
        if (!(selectedModel instanceof SpringAiLlmService springAiModel)) {
            throw new IllegalStateException("configured default model does not expose Spring AI multimodal support");
        }
        this.chatClient = ChatClient.builder(springAiModel.getChatModel()).build();
    }

    /** 將 PNG 頁面送入視覺模型，並拒絕空白回應。 */
    @Override
    public String transcribe(String filename, int pageNumber, byte[] pngBytes) {
        String content = chatClient.prompt()
                .system(TRANSCRIPTION_PROMPT)
                .user(user -> user.text("請忠實轉錄此頁。檔名：" + filename + "；頁碼：" + pageNumber)
                        .media(MimeTypeUtils.IMAGE_PNG, new ByteArrayResource(pngBytes)))
                .call()
                .content();
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("vision model returned an empty transcription");
        }
        return content.trim();
    }
}
