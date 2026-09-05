package tw.lawgraph.usage;

import com.embabel.agent.api.event.AgentProcessEvent;
import com.embabel.agent.api.event.AgenticEventListener;
import com.embabel.agent.api.event.LlmResponseEvent;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.Usage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 監聽 Embabel 的 LLM 回應事件，把每個 agent process 的累計用量餵給每日預算。
 * 以 Spring bean 形式註冊；Embabel 平台會把所有 AgenticEventListener bean 併入 multicast。
 */
public class TokenUsageListener implements AgenticEventListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(TokenUsageListener.class);
    private final DailyTokenBudget budget;
    /** case_event 事件儲存：把每個流程的 token 增量回寫到對應案件。 */
    private final UsageEventStore events;

    /** 相容舊呼叫端與單元測試：token 增量只記在記憶體。 */
    public TokenUsageListener(DailyTokenBudget budget) {
        this(budget, new InMemoryUsageEventStore());
    }

    /** 注入每日預算與事件儲存。 */
    public TokenUsageListener(DailyTokenBudget budget, UsageEventStore events) {
        this.budget = budget;
        this.events = events;
    }

    /** 每次 LLM 回應後讀取 AgentProcess 的累計用量並記入今日預算。 */
    @Override
    public void onProcessEvent(AgentProcessEvent event) {
        if (!(event instanceof LlmResponseEvent<?> response)) return;
        try {
            AgentProcess process = response.getAgentProcess();
            // totalUsage 含子流程；Embabel 回的是該流程累計值，由預算換算增量
            Usage usage = process.totalUsage();
            if (usage == null) return;
            long prompt = usage.getPromptTokens() == null ? 0 : usage.getPromptTokens();
            long completion = usage.getCompletionTokens() == null ? 0 : usage.getCompletionTokens();
            // observeProcessUsage 回的是相對上次觀測的增量，case_event 需累加增量而非累計值
            long[] delta = budget.observeProcessUsage(process.getId(), prompt, completion);
            if (delta[0] + delta[1] > 0) events.recordTokens(process.getId(), delta[0], delta[1]);
            LOGGER.debug("token usage process={} prompt={} completion={} todayUsed={}", process.getId(),
                    prompt, completion, budget.usedTokens());
        } catch (RuntimeException exception) {
            // 用量統計失敗不得影響案件流程
            LOGGER.warn("無法統計 LLM 用量。錯誤類型={}", exception.getClass().getSimpleName());
        }
    }
}
