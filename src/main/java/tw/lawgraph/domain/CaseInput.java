package tw.lawgraph.domain;

import java.util.List;

/** 使用者提交的案情、要求輸出的語系與勾選的書狀類型（建構時即正規化）。 */
public record CaseInput(String text, Locale locale, List<String> documents) {
    public CaseInput {
        documents = DocumentTypes.normalize(documents);
    }

    /** 相容舊呼叫端：未勾選任何書狀。 */
    public CaseInput(String text, Locale locale) {
        this(text, locale, List.of());
    }
}
