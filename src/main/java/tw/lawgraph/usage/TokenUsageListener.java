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

    public TokenUsageListener(DailyTokenBudget budget) {
        this.budget = budget;
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
            budget.observeProcessUsage(process.getId(), prompt, completion);
            LOGGER.debug("token usage process={} prompt={} completion={} todayUsed={}", process.getId(),
                    prompt, completion, budget.usedTokens());
        } catch (RuntimeException exception) {
            // 用量統計失敗不得影響案件流程
            LOGGER.warn("無法統計 LLM 用量。錯誤類型={}", exception.getClass().getSimpleName());
        }
    }
}
