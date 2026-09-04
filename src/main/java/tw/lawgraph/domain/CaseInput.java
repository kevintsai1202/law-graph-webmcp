package tw.lawgraph.domain;

import java.util.List;

/**
 * 使用者提交的案情、要求輸出的語系、勾選的書狀類型、聲請事項與模型覆寫（建構時即正規化）。
 * motionRequest 只在勾選「聲請狀」時有意義：說明要聲請什麼（例如聲請調查證據、聲請假扣押），空白代表未指定。
 * model 為測試用便宜模型覆寫（由 API 層依允許清單過濾後填入），空白代表使用 Embabel 預設模型。
 */
public record CaseInput(String text, Locale locale, List<String> documents, String motionRequest, String model) {
    public CaseInput {
        documents = DocumentTypes.normalize(documents);
        motionRequest = motionRequest == null ? "" : motionRequest.trim();
        model = model == null ? "" : model.trim();
    }

    /** 相容舊呼叫端：未勾選任何書狀。 */
    public CaseInput(String text, Locale locale) {
        this(text, locale, List.of(), "", "");
    }

    /** 相容舊呼叫端：有勾選書狀但無聲請事項。 */
    public CaseInput(String text, Locale locale, List<String> documents) {
        this(text, locale, documents, "", "");
    }

    /** 相容舊呼叫端：無模型覆寫。 */
    public CaseInput(String text, Locale locale, List<String> documents, String motionRequest) {
        this(text, locale, documents, motionRequest, "");
    }

    /** 是否指定了測試模型。 */
    public boolean hasModelOverride() {
        return !model.isBlank();
    }
}
