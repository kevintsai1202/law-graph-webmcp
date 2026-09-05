package tw.lawgraph.llm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.usage.DailyTokenBudget;

import java.util.function.Supplier;

/**
 * 累計經轉送端點的 LLM 呼叫 usage：prompt／cached／completion／reasoning tokens。
 * 目的：量測供應商端 prompt cache 命中率與 reasoning 佔比，決定要不要調整提示詞前綴。記憶體累計，重啟歸零。
 * 五個欄位改用一般 long 並以 synchronized 保護累計與讀取：若各欄位各自用獨立的 AtomicLong，
 * 併發呼叫時 snapshot() 可能讀到「累計到一半」的組合（例如 cached 已累計但 prompt 尚未累計），
 * 導致 cacheHitRatio 短暫失真；用同一把鎖讓每次累計與每次讀取都是原子操作可避免此問題。
 * 另外把每次呼叫的 cached／reasoning tokens 轉送給 DailyTokenBudget，讓 usage_daily 落地這三個欄位。
 */
@Component
public class LlmUsageStats {
    private static final Logger LOGGER = LoggerFactory.getLogger(LlmUsageStats.class);
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    /** 取得 DailyTokenBudget 的方式；用 Supplier 而非直接注入以避開循環相依，也方便測試以 lambda 替換。 */
    private final Supplier<DailyTokenBudget> budget;

    /** 無參數建構子：不轉送任何統計給預算，供不需要此整合的既有測試／呼叫端使用。 */
    public LlmUsageStats() {
        this(() -> null);
    }

    /** 測試／內部使用：以自訂 Supplier 取得 DailyTokenBudget。 */
    public LlmUsageStats(Supplier<DailyTokenBudget> budget) {
        this.budget = budget == null ? () -> null : budget;
    }

    /** Spring 注入建構子：DailyTokenBudget 用 @Lazy 避免與 LlmUsageStats 之間可能的循環相依。 */
    @Autowired
    public LlmUsageStats(@Lazy DailyTokenBudget budget) {
        this(() -> budget);
    }

    /** 統計快照；cacheHitRatio = cachedTokens / promptTokens（無呼叫時為 0）。 */
    public record Snapshot(long calls, long promptTokens, long cachedTokens, long completionTokens,
                           long reasoningTokens, double cacheHitRatio) {}

    private long calls;
    private long prompt;
    private long cached;
    private long completion;
    private long reasoning;

    /** 解析一筆回應 body 的 usage 並累計；回傳這一筆的快照（無 usage 或不是 JSON 時回 null）。 */
    public Snapshot record(String responseBody) {
        if (responseBody == null) return null;
        JsonNode usage;
        try {
            usage = MAPPER.readTree(responseBody).path("usage");
        } catch (RuntimeException parseFailure) {
            return null;
        }
        if (usage.isMissingNode() || !usage.isObject()) return null;
        long p = usage.path("prompt_tokens").asLong(0);
        long c = usage.path("completion_tokens").asLong(0);
        long cachedTokens = usage.path("prompt_tokens_details").path("cached_tokens").asLong(0);
        long reasoningTokens = usage.path("completion_tokens_details").path("reasoning_tokens").asLong(0);
        synchronized (this) {
            calls++;
            prompt += p;
            completion += c;
            cached += cachedTokens;
            reasoning += reasoningTokens;
        }
        // 轉送給每日預算落地；失敗（例如尚未設定資料庫）不得影響轉送端點本身的回應。
        try {
            DailyTokenBudget b = budget.get();
            if (b != null) b.addLlmCall(cachedTokens, reasoningTokens);
        } catch (RuntimeException e) {
            LOGGER.warn("無法把 LLM 呼叫統計轉送給每日預算。錯誤類型={}", e.getClass().getSimpleName());
        }
        return new Snapshot(1, p, cachedTokens, c, reasoningTokens, p == 0 ? 0.0 : (double) cachedTokens / p);
    }

    /** 目前累計值。 */
    public synchronized Snapshot snapshot() {
        return new Snapshot(calls, prompt, cached, completion, reasoning, prompt == 0 ? 0.0 : (double) cached / prompt);
    }
}
