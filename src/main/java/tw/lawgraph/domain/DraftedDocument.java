package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/**
 * 一份 LLM 起草的訴訟書狀（結構化欄位，前端負責美化排版）。
 * type 為 DocumentTypes.CODES 之一；引用之法條與判決僅得逐字複製研究結果。
 * 爭點整理（type=issues）另以 issues[] 提供實務常用的爭點整理表列，前端以表格呈現並可匯出 CSV。
 */
public record DraftedDocument(String type, String title, String court, List<Party> parties,
                              List<String> paragraphs, List<String> attachments, String date,
                              List<IssueRow> issues) {

    /** 相容既有 7 參數呼叫端：無表格列。 */
    public DraftedDocument(String type, String title, String court, List<Party> parties,
                           List<String> paragraphs, List<String> attachments, String date) {
        this(type, title, court, parties, paragraphs, attachments, date, List.of());
    }

    /** 模型常省略欄位或塞 null 元素，一律正規化為空集合。 */
    public DraftedDocument {
        parties = parties == null ? List.of() : parties.stream().filter(Objects::nonNull).toList();
        paragraphs = paragraphs == null ? List.of() : paragraphs.stream().filter(Objects::nonNull).toList();
        attachments = attachments == null ? List.of() : attachments.stream().filter(Objects::nonNull).toList();
        issues = issues == null ? List.of() : issues.stream().filter(Objects::nonNull).toList();
    }

    /** 當事人欄的一列：訴訟地位（原告、被告、聲請人...）與姓名稱謂。 */
    public record Party(String role, String name) {}

    /**
     * 爭點整理表的一列：編號、爭點、原告主張、被告主張、法律依據（僅得引用研究結果）、證據方法、法院應審酌事項。
     * 各欄 null 以空字串取代，前端與 CSV 才不會出現 "null"。
     */
    public record IssueRow(String no, String issue, String plaintiff, String defendant, String basis,
                           String evidence, String court) {
        public IssueRow {
            no = blankIfNull(no);
            issue = blankIfNull(issue);
            plaintiff = blankIfNull(plaintiff);
            defendant = blankIfNull(defendant);
            basis = blankIfNull(basis);
            evidence = blankIfNull(evidence);
            court = blankIfNull(court);
        }

        private static String blankIfNull(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
