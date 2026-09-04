package tw.lawgraph.domain;

import java.util.List;

/**
 * 一份 LLM 起草的訴訟書狀（結構化欄位，前端負責美化排版）。
 * type 為 DocumentTypes.CODES 之一；引用之法條與判決僅得逐字複製研究結果。
 */
public record DraftedDocument(String type, String title, String court, List<Party> parties,
                              List<String> paragraphs, List<String> attachments, String date) {
    /** 當事人欄的一列：訴訟地位（原告、被告、聲請人...）與姓名稱謂。 */
    public record Party(String role, String name) {}
}
