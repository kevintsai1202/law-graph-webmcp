package tw.lawgraph.usage;

import com.embabel.agent.api.event.LlmResponseEvent;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.Usage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 監聽器只在 LlmResponseEvent 時讀取 AgentProcess 累計用量並記入預算。 */
class TokenUsageListenerTest {

    @Test
    void recordsUsageFromLlmResponseEvent() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var listener = new TokenUsageListener(budget);
        AgentProcess process = mock(AgentProcess.class);
        when(process.getId()).thenReturn("proc-1");
        when(process.totalUsage()).thenReturn(new Usage(1200, 300, null));
        @SuppressWarnings("unchecked")
        LlmResponseEvent<Object> event = mock(LlmResponseEvent.class);
        when(event.getAgentProcess()).thenReturn(process);

        listener.onProcessEvent(event);
        when(process.totalUsage()).thenReturn(new Usage(2000, 500, null));
        listener.onProcessEvent(event);

        assertEquals(2500, budget.usedTokens());
    }
}
