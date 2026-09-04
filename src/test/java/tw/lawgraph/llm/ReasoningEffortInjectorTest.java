package tw.lawgraph.llm;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 轉送 LLM 請求前注入 reasoning_effort：只在有設定且請求未自帶時加入，其餘原樣保留。 */
class ReasoningEffortInjectorTest {

    /** 有設定 low 且請求沒帶 → 加入 reasoning_effort=low，其他欄位不動。 */
    @Test void injectsWhenConfiguredAndAbsent() {
        String out = ReasoningEffortInjector.inject("{\"model\":\"m\",\"messages\":[]}", "low");
        assertEquals("{\"model\":\"m\",\"messages\":[],\"reasoning_effort\":\"low\"}", out);
    }

    /** 請求已自帶 reasoning_effort 時尊重呼叫端，不覆寫。 */
    @Test void keepsExistingValue() {
        String body = "{\"model\":\"m\",\"reasoning_effort\":\"high\"}";
        assertEquals(body, ReasoningEffortInjector.inject(body, "low"));
    }

    /** 未設定（空字串或 null）時原樣回傳。 */
    @Test void passesThroughWhenNotConfigured() {
        String body = "{\"model\":\"m\"}";
        assertEquals(body, ReasoningEffortInjector.inject(body, ""));
        assertEquals(body, ReasoningEffortInjector.inject(body, null));
    }

    /** 不是 JSON 物件（例如壞掉的 body）就原樣轉送，交給上游回錯。 */
    @Test void passesThroughNonObjectBody() {
        assertEquals("not json", ReasoningEffortInjector.inject("not json", "low"));
    }
}
