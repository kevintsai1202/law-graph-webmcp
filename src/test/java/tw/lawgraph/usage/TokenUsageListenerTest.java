package tw.lawgraph.usage;

import com.embabel.agent.api.event.LlmResponseEvent;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.Usage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 監聽器只在 LlmResponseEvent 時讀取 AgentProcess 累計用量，記入預算並把增量回寫 case_event。 */
class TokenUsageListenerTest {

    /** 建立一個回傳指定累計用量的假事件。 */
    private static LlmResponseEvent<Object> eventFor(AgentProcess process) {
        @SuppressWarnings("unchecked")
        LlmResponseEvent<Object> event = mock(LlmResponseEvent.class);
        when(event.getAgentProcess()).thenReturn(process);
        return event;
    }

    @Test
    void recordsUsageFromLlmResponseEvent() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var listener = new TokenUsageListener(budget);
        AgentProcess process = mock(AgentProcess.class);
        when(process.getId()).thenReturn("proc-1");
        when(process.totalUsage()).thenReturn(new Usage(1200, 300, null));
        LlmResponseEvent<Object> event = eventFor(process);

        listener.onProcessEvent(event);
        when(process.totalUsage()).thenReturn(new Usage(2000, 500, null));
        listener.onProcessEvent(event);

        assertEquals(2500, budget.usedTokens());
    }

    /** 事件回報的是流程累計值，寫入 case_event 的必須是相對上次的增量。 */
    @Test
    void recordsTokenDeltaToEventStore() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var events = mock(UsageEventStore.class);
        var listener = new TokenUsageListener(budget, events);
        AgentProcess process = mock(AgentProcess.class);
        when(process.getId()).thenReturn("p1");
        when(process.totalUsage()).thenReturn(new Usage(100, 10, null));
        LlmResponseEvent<Object> event = eventFor(process);

        listener.onProcessEvent(event);
        verify(events).recordTokens("p1", 100, 10);

        when(process.totalUsage()).thenReturn(new Usage(130, 15, null));
        listener.onProcessEvent(event);
        verify(events).recordTokens("p1", 30, 5);
    }

    /** 增量為 0 時不必寫 case_event。 */
    @Test
    void skipsEventStoreWhenNoDelta() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var events = mock(UsageEventStore.class);
        var listener = new TokenUsageListener(budget, events);
        AgentProcess process = mock(AgentProcess.class);
        when(process.getId()).thenReturn("p1");
        when(process.totalUsage()).thenReturn(new Usage(50, 5, null));
        LlmResponseEvent<Object> event = eventFor(process);

        listener.onProcessEvent(event);
        listener.onProcessEvent(event);

        verify(events, times(1)).recordTokens("p1", 50, 5);
    }

    /** case_event 寫入失敗不得影響案件流程，預算仍需記錄。 */
    @Test
    void eventStoreFailureDoesNotBreakBudget() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var events = mock(UsageEventStore.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down"))
                .when(events).recordTokens(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong());
        var listener = new TokenUsageListener(budget, events);
        AgentProcess process = mock(AgentProcess.class);
        when(process.getId()).thenReturn("p1");
        when(process.totalUsage()).thenReturn(new Usage(100, 10, null));

        listener.onProcessEvent(eventFor(process));

        assertEquals(110, budget.usedTokens());
    }

    /** 非 LLM 回應事件不做任何事。 */
    @Test
    void ignoresNonLlmEvents() {
        var budget = new DailyTokenBudget(2_000_000, false, null);
        var events = mock(UsageEventStore.class);
        new TokenUsageListener(budget, events)
                .onProcessEvent(mock(com.embabel.agent.api.event.AgentProcessEvent.class));
        verify(events, never()).recordTokens(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong());
    }
}
