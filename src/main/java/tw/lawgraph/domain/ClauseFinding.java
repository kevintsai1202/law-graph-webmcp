package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/**
 * 單一條款的審查結果（對應 compliance-verification 步驟三的風險條款評級清單一列）。
 * lawRefs／judgmentCitations 必須逐字複製 research.laws[].ref／judgments[].citation，由 Java 依白名單過濾。
 * risk 缺漏時視為 medium（寧可提醒，不可漏標）。
 */
public record ClauseFinding(String clauseNo, String clauseText, Risk risk, List<String> lawRefs,
                            String riskPoint, String suggestion, List<String> judgmentCitations) {
    public ClauseFinding {
        clauseNo = clauseNo == null ? "" : clauseNo.trim();
        clauseText = clauseText == null ? "" : clauseText;
        risk = risk == null ? Risk.medium : risk;
        lawRefs = clean(lawRefs);
        riskPoint = riskPoint == null ? "" : riskPoint;
        suggestion = suggestion == null ? "" : suggestion;
        judgmentCitations = clean(judgmentCitations);
    }

    /** 去 null、去空白、去重。 */
    private static List<String> clean(List<String> values) {
        return values == null ? List.of() : values.stream().filter(Objects::nonNull).map(String::trim)
                .filter(v -> !v.isBlank()).distinct().toList();
    }

    /** 以新的引用清單複製（白名單過濫用）。 */
    public ClauseFinding withRefs(List<String> laws, List<String> judgments) {
        return new ClauseFinding(clauseNo, clauseText, risk, laws, riskPoint, suggestion, judgments);
    }
}
