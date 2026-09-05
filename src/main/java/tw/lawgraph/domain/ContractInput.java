package tw.lawgraph.domain;

import java.util.List;
import java.util.Set;

/**
 * 合約審查輸入：合約原文（或商業行為描述）、語系、我方立場、審查範疇、勾選輸出與測試模型覆寫。
 * party 只接受 partyA／partyB／unknown；scopes 依 ContractScopes 白名單；outputs 目前只有 revised（修訂版條款）。
 */
public record ContractInput(String text, Locale locale, String party, List<String> scopes, List<String> outputs, String model) {
    /** 合法的我方立場值。 */
    public static final Set<String> PARTIES = Set.of("partyA", "partyB", "unknown");
    /** 合法的輸出勾選值。 */
    public static final List<String> OUTPUTS = List.of("revised");

    public ContractInput {
        text = text == null ? "" : text.trim();
        String p = party == null ? "" : party.trim();
        party = PARTIES.contains(p) ? p : "unknown";
        scopes = ContractScopes.normalize(scopes);
        outputs = outputs == null ? List.of() : OUTPUTS.stream().filter(outputs::contains).toList();
        model = model == null ? "" : model.trim();
    }

    /** 是否指定了測試模型。 */
    public boolean hasModelOverride() { return !model.isBlank(); }

    /** 是否勾選修訂版條款。 */
    public boolean wantsRevised() { return outputs.contains("revised"); }
}
