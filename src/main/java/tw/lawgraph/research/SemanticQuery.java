package tw.lawgraph.research;

/**
 * 送往 tw-legal-rag 語意檢索的最終查詢文字。
 * 由 Embabel 依條件擇一產生：案情未超過 provider 上限時原文照用；超過時先由 LLM 摘要。
 */
public record SemanticQuery(String text) {
    public SemanticQuery {
        text = text == null ? "" : text.trim();
    }
}
