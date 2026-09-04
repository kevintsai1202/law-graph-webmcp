package tw.lawgraph.domain;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

/**
 * 台灣法律用語守門：模型偶爾混入大陸或其他法域用語，這裡以黑名單自動替換為台灣實務用語，
 * 並把命中的詞記到 WARN log 供觀察 prompt 品質。只處理明確一對一的詞，避免誤改台灣本有用語
 * （例如「起訴書」在台灣是檢察官文書，不在名單內）。
 */
public final class TaiwanTerminology {
    private static final Logger LOGGER = LoggerFactory.getLogger(TaiwanTerminology.class);

    /** 黑名單 → 台灣用語；順序有意義：長詞先換，避免「訴訟費用」被「訴訟費」規則誤傷。 */
    static final Map<String, String> REPLACEMENTS = new LinkedHashMap<>();

    static {
        // 程序與文書
        REPLACEMENTS.put("訴訟請求", "訴之聲明");
        REPLACEMENTS.put("事實與理由", "事實及理由");
        REPLACEMENTS.put("答辯書", "答辯狀");
        REPLACEMENTS.put("證據材料", "證據方法");
        REPLACEMENTS.put("證人證言", "證人證述");
        REPLACEMENTS.put("人民法院", "法院");
        REPLACEMENTS.put("法人代表", "法定代理人");
        REPLACEMENTS.put("律師費", "律師酬金");
        REPLACEMENTS.put("判令", "判命");
        REPLACEMENTS.put("訴訟費由", "訴訟費用由");
        REPLACEMENTS.put("由被告承擔", "由被告負擔");
        REPLACEMENTS.put("由原告承擔", "由原告負擔");
        // 當事人稱謂
        REPLACEMENTS.put("雙方當事人", "兩造");
        REPLACEMENTS.put("原告方", "原告");
        REPLACEMENTS.put("被告方", "被告");
        // 實體法用語
        REPLACEMENTS.put("民法典", "民法");
        REPLACEMENTS.put("合同法", "民法債編");
        REPLACEMENTS.put("合同", "契約");
        REPLACEMENTS.put("損失賠償", "損害賠償");
        REPLACEMENTS.put("房產", "不動產");
        REPLACEMENTS.put("產權", "所有權");
        // 一般用語
        REPLACEMENTS.put("質量", "品質");
        REPLACEMENTS.put("信息", "資訊");
        REPLACEMENTS.put("數據", "資料");
        REPLACEMENTS.put("軟件", "軟體");
        REPLACEMENTS.put("網絡", "網路");
        REPLACEMENTS.put("視頻", "影片");
    }

    private TaiwanTerminology() {}

    /** 回傳文字中命中的黑名單詞（去重、依名單順序）。 */
    public static List<String> hits(String text) {
        if (text == null || text.isBlank()) return List.of();
        return REPLACEMENTS.keySet().stream().filter(text::contains).toList();
    }

    /** 替換單一文字；null 原樣回傳。 */
    public static String sanitize(String text) {
        if (text == null || text.isBlank()) return text;
        String result = text;
        for (Map.Entry<String, String> entry : REPLACEMENTS.entrySet()) {
            result = result.replace(entry.getKey(), entry.getValue());
        }
        return result;
    }

    /** 分析結果：要件、依據、事實、策略、證據缺口全部過一遍。 */
    public static AnalysisResult sanitize(AnalysisResult analysis) {
        if (analysis == null) return null;
        Auditor audit = new Auditor("analysis");
        List<ElementFinding> elements = analysis.elements() == null ? List.of() : analysis.elements().stream()
                .filter(Objects::nonNull)
                .map(finding -> new ElementFinding(finding.law(), audit.fix(finding.element()), finding.met(),
                        audit.fix(finding.basis()), audit.fix(finding.fact())))
                .toList();
        AnalysisResult cleaned = new AnalysisResult(elements, audit.fix(analysis.strategy()),
                audit.fixAll(analysis.evidenceGaps()), audit.fix(analysis.disclaimer()));
        audit.report();
        return cleaned;
    }

    /** 書狀：標題、段落、證物、表格列全部過一遍；法條 ref 不動（來自檢索結果）。 */
    public static DraftedDocuments sanitize(DraftedDocuments documents) {
        if (documents == null || documents.documents() == null) return documents;
        Auditor audit = new Auditor("documents");
        List<DraftedDocument> cleaned = documents.documents().stream().filter(Objects::nonNull).map(doc -> new DraftedDocument(
                doc.type(), audit.fix(doc.title()), audit.fix(doc.court()),
                doc.parties().stream().map(p -> new DraftedDocument.Party(audit.fix(p.role()), audit.fix(p.name()))).toList(),
                audit.fixAll(doc.paragraphs()), audit.fixAll(doc.attachments()), doc.date(),
                doc.issues().stream().map(row -> new DraftedDocument.IssueRow(row.no(), audit.fix(row.issue()),
                        audit.fix(row.plaintiff()), audit.fix(row.plaintiffEvidence()), audit.fix(row.defendant()),
                        audit.fix(row.defendantEvidence()), audit.fix(row.basis()))).toList(),
                doc.claimsBasis().stream().map(row -> new DraftedDocument.ClaimBasisRow(row.no(), audit.fix(row.basis()),
                        audit.fix(row.claim()))).toList(),
                doc.undisputed().stream().map(row -> new DraftedDocument.UndisputedRow(row.no(), audit.fix(row.fact()),
                        audit.fix(row.evidence()))).toList()))
                .toList();
        audit.report();
        return new DraftedDocuments(cleaned);
    }

    /** 對 CaseAssessment 的所有文字欄位套用同一套黑名單替換；風險等級與結構不變。 */
    public static CaseAssessment sanitize(CaseAssessment assessment) {
        if (assessment == null) return null;
        Auditor audit = new Auditor("caseAssessment");
        var defenses = assessment.defenses().stream()
                .map(d -> new DefenseAssessment(audit.fix(d.issue()), audit.fix(d.defense()), audit.fix(d.response()), d.risk()))
                .toList();
        var evidence = assessment.evidencePlan().stream()
                .map(e -> new EvidenceItem(audit.fix(e.fact()), audit.fix(e.burden()), audit.fix(e.available()),
                        audit.fix(e.missing()), audit.fix(e.howToObtain())))
                .toList();
        var checklist = assessment.checklist().stream()
                .map(c -> new ChecklistItem(audit.fix(c.category()), audit.fix(c.item()), audit.fix(c.why()), audit.fix(c.dueHint())))
                .toList();
        audit.report();
        return new CaseAssessment(defenses, evidence, checklist, audit.fix(assessment.riskSummary()));
    }

    /** 收集一次淨化過程命中的詞，最後只寫一行 WARN。 */
    private static final class Auditor {
        private final String scope;
        private final TreeSet<String> found = new TreeSet<>();

        Auditor(String scope) { this.scope = scope; }

        String fix(String text) {
            found.addAll(hits(text));
            return sanitize(text);
        }

        List<String> fixAll(List<String> values) {
            if (values == null) return List.of();
            return values.stream().filter(Objects::nonNull).map(this::fix).toList();
        }

        void report() {
            if (!found.isEmpty()) {
                LOGGER.warn("非台灣法律用語已自動替換 scope={} terms={}", scope, found);
            }
        }

    }
}
