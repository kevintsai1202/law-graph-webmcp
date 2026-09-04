package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/** assessCase Action 的產物：對造抗辯評估、舉證責任與證據計畫、當事人準備清單、風險摘要。null 一律兜底成空值。 */
public record CaseAssessment(List<DefenseAssessment> defenses, List<EvidenceItem> evidencePlan,
                             List<ChecklistItem> checklist, String riskSummary) {
    public CaseAssessment {
        defenses = defenses == null ? List.of() : List.copyOf(defenses.stream().filter(Objects::nonNull).toList());
        evidencePlan = evidencePlan == null ? List.of() : List.copyOf(evidencePlan.stream().filter(Objects::nonNull).toList());
        checklist = checklist == null ? List.of() : List.copyOf(checklist.stream().filter(Objects::nonNull).toList());
        riskSummary = riskSummary == null ? "" : riskSummary;
    }
}
