package tw.lawgraph.domain;
import java.util.List;
import java.util.Objects;
/** reviseClauses 的產物：高／中風險條款的修訂版對照。未勾選時為 EMPTY，不呼叫 LLM。 */
public record RevisedClauses(List<RevisedClause> items) {
    public static final RevisedClauses EMPTY = new RevisedClauses(List.of());
    public RevisedClauses { items = items == null ? List.of() : items.stream().filter(Objects::nonNull).toList(); }
    /** 一條修訂：條號、原文、修訂後條文、修改理由（引用法規依據）。 */
    public record RevisedClause(String clauseNo, String original, String revised, String rationale) {
        public RevisedClause {
            clauseNo = clauseNo == null ? "" : clauseNo.trim(); original = original == null ? "" : original;
            revised = revised == null ? "" : revised; rationale = rationale == null ? "" : rationale;
        }
    }
}
