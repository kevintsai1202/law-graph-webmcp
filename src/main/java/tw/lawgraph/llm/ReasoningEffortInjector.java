package tw.lawgraph.llm;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 在 OpenAI 相容的 chat/completions 請求 body 加上 reasoning_effort。
 * Embabel／Spring AI 目前不會送這個參數，Muse 這類 reasoning 模型就走供應商預設（約 medium）；
 * 由設定統一注入可把單次呼叫時間砍半。呼叫端若已自帶則尊重不覆寫。
 */
public final class ReasoningEffortInjector {
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private ReasoningEffortInjector() {}

    /** 有設定且 body 是尚未帶 reasoning_effort 的 JSON 物件才加入；其他情況原樣回傳。 */
    public static String inject(String body, String effort) {
        if (effort == null || effort.isBlank() || body == null) return body;
        JsonNode root;
        try {
            root = MAPPER.readTree(body);
        } catch (RuntimeException parseFailure) {
            return body;
        }
        if (!(root instanceof ObjectNode object) || object.has("reasoning_effort")) return body;
        object.put("reasoning_effort", effort.trim());
        return MAPPER.writeValueAsString(object);
    }
}
