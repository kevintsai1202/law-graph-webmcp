package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/** reviewClauses 的產物：各批次合併後的條款審查清單與過濃紀錄。 */
public record ClauseFindings(List<ClauseFinding> findings, List<String> notes) {
    public ClauseFindings {
        findings = findings == null ? List.of() : findings.stream().filter(Objects::nonNull).toList();
        notes = notes == null ? List.of() : notes.stream().filter(Objects::nonNull).toList();
    }
}
