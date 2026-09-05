package tw.lawgraph.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** summarizeCompliance 的產物：契約類型、範疇、整體風險（取最高）、條款清單、優先修改順序、免責聲明。 */
public record ComplianceReport(String contractType, List<String> scopes, Risk overallRisk,
                               List<ClauseFinding> findings, List<String> priorities, String disclaimer) {
    /** agents-rules §4 的自動免責聲明。 */
    public static final String DEFAULT_DISCLAIMER =
            "本報告由 AI 依台灣現行法規自動比對產生，僅供合約審查輔助，不構成法律意見；重要條款請交由執業律師確認。";

    public ComplianceReport {
        contractType = contractType == null ? "" : contractType.trim();
        scopes = scopes == null ? List.of() : scopes.stream().filter(Objects::nonNull).distinct().toList();
        findings = findings == null ? List.of() : findings.stream().filter(Objects::nonNull).toList();
        overallRisk = overallRisk == null ? highest(findings) : overallRisk;
        priorities = priorities == null ? List.of() : priorities.stream().filter(Objects::nonNull).toList();
        disclaimer = disclaimer == null || disclaimer.isBlank() ? DEFAULT_DISCLAIMER : disclaimer;
    }

    /** 清單中最高的風險；空清單視為 low。high > medium > low 依 enum 宣告順序（high 在前）。 */
    public static Risk highest(List<ClauseFinding> findings) {
        return findings.stream().map(ClauseFinding::risk).min(Comparator.comparingInt(Enum::ordinal)).orElse(Risk.low);
    }
}
