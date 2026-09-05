package tw.lawgraph.llm;

import org.junit.jupiter.api.Test;
import tw.lawgraph.usage.DailyTokenBudget;
import tw.lawgraph.usage.UsageStore;

import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 從 OpenAI 相容回應的 usage 累計 prompt／cached／completion／reasoning tokens，算出快取命中率。 */
class LlmUsageStatsTest {
    private static final String BODY = """
            {"id":"x","usage":{"prompt_tokens":1000,"completion_tokens":300,"total_tokens":1300,
             "completion_tokens_details":{"reasoning_tokens":250},"prompt_tokens_details":{"cached_tokens":400}}}
            """;

    @Test void accumulatesAndComputesRatio() {
        var stats = new LlmUsageStats();
        stats.record(BODY);
        stats.record(BODY.replace("\"cached_tokens\":400", "\"cached_tokens\":0"));
        var snap = stats.snapshot();
        assertEquals(2, snap.calls());
        assertEquals(2000, snap.promptTokens());
        assertEquals(400, snap.cachedTokens());
        assertEquals(600, snap.completionTokens());
        assertEquals(500, snap.reasoningTokens());
        assertEquals(0.2, snap.cacheHitRatio(), 1e-9);
    }

    /** record() 成功解析後要把 cached／reasoning tokens 轉送給每日預算。 */
    @Test void recordForwardsToBudget() {
        var budget = new DailyTokenBudget(0, false, UsageStore.inMemory(), Clock.systemUTC());
        var stats = new LlmUsageStats(() -> budget);

        stats.record("{\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4,"
                + "\"prompt_tokens_details\":{\"cached_tokens\":6},"
                + "\"completion_tokens_details\":{\"reasoning_tokens\":1}}}");

        assertEquals(1, budget.snapshot().llmCalls());
        assertEquals(6, budget.snapshot().cachedTokens());
    }

    @Test void ignoresBodiesWithoutUsage() {
        var stats = new LlmUsageStats();
        stats.record("{\"error\":\"x\"}");
        stats.record("not json");
        assertEquals(0, stats.snapshot().calls());
        assertEquals(0.0, stats.snapshot().cacheHitRatio(), 1e-9);
    }
}
