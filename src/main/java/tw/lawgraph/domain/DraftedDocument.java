package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/**
 * 一份 LLM 起草的訴訟書狀（結構化欄位，前端負責美化排版）。
 * type 為 DocumentTypes.CODES 之一；引用之法條與判決僅得逐字複製研究結果。
 * 表格欄位對應司法院官方範本：爭點整理表（issues）、聲明與請求權基礎清單（claimsBasis）、不爭執事項清單（undisputed）。
 */
public record DraftedDocument(String type, String title, String court, List<Party> parties,
                              List<String> paragraphs, List<String> attachments, String date,
                              List<IssueRow> issues, List<ClaimBasisRow> claimsBasis, List<UndisputedRow> undisputed) {

    /** 相容既有 7 參數呼叫端：無任何表格。 */
    public DraftedDocument(String type, String title, String court, List<Party> parties,
                           List<String> paragraphs, List<String> attachments, String date) {
        this(type, title, court, parties, paragraphs, attachments, date, List.of(), List.of(), List.of());
    }

    /** 相容只帶爭點整理表的 8 參數呼叫端。 */
    public DraftedDocument(String type, String title, String court, List<Party> parties,
                           List<String> paragraphs, List<String> attachments, String date, List<IssueRow> issues) {
        this(type, title, court, parties, paragraphs, attachments, date, issues, List.of(), List.of());
    }

    /** 模型常省略欄位或塞 null 元素，一律正規化為空集合。 */
    public DraftedDocument {
        parties = parties == null ? List.of() : parties.stream().filter(Objects::nonNull).toList();
        paragraphs = paragraphs == null ? List.of() : paragraphs.stream().filter(Objects::nonNull).toList();
        attachments = attachments == null ? List.of() : attachments.stream().filter(Objects::nonNull).toList();
        issues = issues == null ? List.of() : issues.stream().filter(Objects::nonNull).toList();
        claimsBasis = claimsBasis == null ? List.of() : claimsBasis.stream().filter(Objects::nonNull).toList();
        undisputed = undisputed == null ? List.of() : undisputed.stream().filter(Objects::nonNull).toList();
    }

    /** 當事人欄的一列：訴訟地位（原告、被告、聲請人...）與姓名稱謂。 */
    public record Party(String role, String name) {}

    /**
     * 司法院「爭點整理表」一列：序次、爭點（問句）、原告主張、原告證據、被告抗辯、被告證據、法律依據。
     * 證據以「甲證1–○○」「乙證1–○○」標示；法律依據只得引用研究結果。各欄 null 以空字串取代。
     */
    public record IssueRow(String no, String issue, String plaintiff, String plaintiffEvidence,
                           String defendant, String defendantEvidence, String basis) {
        public IssueRow {
            no = blank(no);
            issue = blank(issue);
            plaintiff = blank(plaintiff);
            plaintiffEvidence = blank(plaintiffEvidence);
            defendant = blank(defendant);
            defendantEvidence = blank(defendantEvidence);
            basis = blank(basis);
        }
    }

    /** 司法院「聲明與請求權基礎清單」一列：序次、請求權基礎、原告之聲明。 */
    public record ClaimBasisRow(String no, String basis, String claim) {
        public ClaimBasisRow {
            no = blank(no);
            basis = blank(basis);
            claim = blank(claim);
        }
    }

    /** 司法院「不爭執事項清單」一列：序次、兩造不爭執事實、證據。 */
    public record UndisputedRow(String no, String fact, String evidence) {
        public UndisputedRow {
            no = blank(no);
            fact = blank(fact);
            evidence = blank(evidence);
        }
    }

    private static String blank(String value) {
        return value == null ? "" : value.trim();
    }
}
