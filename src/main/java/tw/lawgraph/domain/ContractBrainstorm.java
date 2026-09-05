package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/** loadContract 的產物：契約類型、審查範疇、當事人、切分後的條款清單、待問問題與一段摘要。null 一律兜底。 */
public record ContractBrainstorm(String contractType, List<String> scopes, List<ContractParty> parties,
                                 List<Clause> clauses, List<Question> questions, String summary) {
    public ContractBrainstorm {
        contractType = contractType == null ? "" : contractType.trim();
        scopes = scopes == null ? List.of() : scopes.stream().filter(Objects::nonNull).distinct().toList();
        parties = parties == null ? List.of() : parties.stream().filter(Objects::nonNull).toList();
        clauses = clauses == null ? List.of() : clauses.stream().filter(Objects::nonNull).toList();
        questions = questions == null ? List.of() : questions.stream().filter(Objects::nonNull).toList();
        summary = summary == null ? "" : summary;
    }

    /** 契約條款：編號（如「第3條」「3.2」）與原文。 */
    public record Clause(String clauseNo, String text) {
        public Clause { clauseNo = clauseNo == null ? "" : clauseNo.trim(); text = text == null ? "" : text; }
    }

    /** 契約當事人：名稱與地位（甲方（委託人）、乙方（受託人）…）。 */
    public record ContractParty(String name, String role) {
        public ContractParty { name = name == null ? "" : name.trim(); role = role == null ? "" : role.trim(); }
    }
}
