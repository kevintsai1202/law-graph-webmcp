package tw.lawgraph.api;

import com.embabel.agent.core.Agent;
import com.embabel.agent.core.AgentPlatform;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.core.Blackboard;
import com.embabel.agent.core.ProcessOptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.agent.QuestionsAwaitable;
import tw.lawgraph.agent.SecondRoundQuestionsAwaitable;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.SecondRoundAnswers;
import tw.lawgraph.domain.UserAnswers;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.usage.UsageEventStore;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** CaseService 是 REST 與 Embabel 之間唯一的黏合層。 */
class CaseServiceTest {
    private final AgentPlatform platform = mock(AgentPlatform.class);
    private final Agent agent = mock(Agent.class);
    private final AgentProcess process = mock(AgentProcess.class);
    private final Blackboard blackboard = mock(Blackboard.class);
    private CaseService service;

    /** 建立可啟動的假 Agent 流程。 */
    @BeforeEach
    void setUp() {
        when(agent.getName()).thenReturn(LegalGraphAgent.AGENT_NAME);
        when(platform.agents()).thenReturn(List.of(agent));
        when(platform.createAgentProcessFrom(eq(agent), any(ProcessOptions.class), any())).thenReturn(process);
        when(platform.getAgentProcess("p1")).thenReturn(process);
        when(platform.start(process)).thenReturn(CompletableFuture.completedFuture(process));
        when(process.getId()).thenReturn("p1");
        when(process.getBlackboard()).thenReturn(blackboard);
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.RUNNING);
        service = new CaseService(platform);
    }

    /** 啟動時綁定輸入（含勾選書狀）並呼叫非同步 start。 */
    @Test void startCreatesProcessBindsCaseInputAndStartsAsync() {
        var status = service.start("A hit B", Locale.ZH_TW, List.of("complaint"));
        assertEquals("p1", status.caseId()); assertEquals("RUNNING", status.status());
        assertEquals("zh-TW", status.locale());
        verify(platform).createAgentProcessFrom(eq(agent), any(ProcessOptions.class),
                eq(new CaseInput("A hit B", Locale.ZH_TW, List.of("complaint"))));
        verify(platform).start(process);
    }

    /** 未知 ID 必須拋出 404 對應例外。 */
    @Test void statusUnknownIdThrows404() {
        assertThrows(CaseNotFoundException.class, () -> service.status("nope"));
    }

    /** 非 WAITING 不接受回答。 */
    @Test void answerWhenNotWaitingThrows409() {
        service.start("x", Locale.EN, List.of());
        assertThrows(CaseNotWaitingException.class,
                () -> service.answer("p1", List.of(new Answer("q1", "yes"))));
    }

    /** WAITING 時寫入答案並重新啟動流程。 */
    @Test void answerWhenWaitingFeedsAwaitableAndResumes() {
        service.start("x", Locale.EN, List.of());
        var awaitable = new QuestionsAwaitable(List.of(new Question("q1", "?", "why")));
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.WAITING);
        when(blackboard.last(QuestionsAwaitable.class)).thenReturn(awaitable);
        var status = service.answer("p1", List.of(new Answer("q1", "yes")));
        verify(blackboard).addObject(new UserAnswers(List.of(new Answer("q1", "yes"))));
        verify(platform, times(2)).start(process); assertNotNull(status);
    }

    /**
     * platform.start 是非同步：回答寫入後流程可能還停在 WAITING、等待物件仍在 blackboard。
     * 此時回傳的狀態不得再是 WAITING（前端會重畫同一組問題並停止輪詢，看起來像「按了沒反應」），要視為 RUNNING。
     */
    @Test void answerMasksStaleWaitingUntilProcessResumes() {
        service.start("x", Locale.EN, List.of());
        var awaitable = new SecondRoundQuestionsAwaitable(List.of(new Question("r2q1", "?", "why")));
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.WAITING);
        when(blackboard.last(SecondRoundQuestionsAwaitable.class)).thenReturn(awaitable);
        var afterAnswer = service.answer("p1", List.of(new Answer("r2q1", "second")));
        assertEquals("RUNNING", afterAnswer.status());
        assertEquals(null, afterAnswer.questions());
        // 後續輪詢在流程真正接手前也不得回到 WAITING
        assertEquals("RUNNING", service.status("p1").status());
        // 同一等待物件不可重複回答
        assertThrows(CaseNotWaitingException.class, () -> service.answer("p1", List.of(new Answer("r2q1", "again"))));
        // 流程接手後進入下一輪新的等待物件，才恢復 WAITING
        var third = new tw.lawgraph.agent.ThirdRoundQuestionsAwaitable(List.of(new Question("r3q1", "?", "why")));
        when(blackboard.last(tw.lawgraph.agent.ThirdRoundQuestionsAwaitable.class)).thenReturn(third);
        assertEquals("WAITING", service.status("p1").status());
        assertEquals("r3q1", service.status("p1").questions().get(0).id());
    }

    /** 第二輪 WAITING 必須把答案寫成獨立型別，避免被第一輪 UserAnswers 吞掉。 */
    @Test void answerSecondRoundUsesDistinctPayloadAndResumes() {
        service.start("x", Locale.EN, List.of());
        var awaitable = new SecondRoundQuestionsAwaitable(List.of(new Question("r2q1", "?", "why")));
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.WAITING);
        when(blackboard.last(SecondRoundQuestionsAwaitable.class)).thenReturn(awaitable);
        var status = service.answer("p1", List.of(new Answer("r2q1", "second")));
        verify(blackboard).addObject(new SecondRoundAnswers(List.of(new Answer("r2q1", "second"))));
        verify(platform, times(2)).start(process); assertNotNull(status);
    }

    /** 同一步驤超過上限：看門狗 kill 流程，狀態回 FAILED／STEP_TIMEOUT 並帶中文逾時訊息。 */
    @Test void sweepKillsStuckStepAndReportsTimeout() {
        var clock = mock(Clock.class);
        when(clock.millis()).thenReturn(0L, 301_000L);
        // recordStart 需要 instant()；不 stub 會回 null 讓啟動事件寫入失敗
        when(clock.instant()).thenReturn(Instant.parse("2026-09-05T02:00:00Z"));
        var timed = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), clock);
        timed.start("x", Locale.ZH_TW, List.of());
        timed.sweep();
        verify(process, never()).kill();
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.RUNNING, AgentProcessStatusCode.RUNNING,
                AgentProcessStatusCode.KILLED);
        timed.sweep();
        verify(process).kill();
        var status = timed.status("p1");
        assertEquals("FAILED", status.status());
        assertEquals("STEP_TIMEOUT", status.error().code());
        assertEquals("BRAINSTORM", status.error().step());
        assertTrue(status.error().message().contains("300"), status.error().message());
        assertTrue(status.error().message().contains("逾時"), status.error().message());
    }

    /** 等待回答不計入逾時。 */
    @Test void sweepIgnoresWaitingProcesses() {
        var clock = mock(Clock.class);
        when(clock.millis()).thenReturn(0L, 900_000L);
        when(clock.instant()).thenReturn(Instant.parse("2026-09-05T02:00:00Z"));
        var timed = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), clock);
        timed.start("x", Locale.EN, List.of());
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.WAITING);
        timed.sweep(); timed.sweep();
        verify(process, never()).kill();
    }

    /** 案件跑完（COMPLETED）時只回寫一次終態，重複查詢不得重複寫入。 */
    @Test void statusRecordsFinishOnceWhenCompleted() {
        var events = mock(UsageEventStore.class);
        var finishing = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);
        finishing.start("x", Locale.ZH_TW, List.of());
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.COMPLETED);
        when(blackboard.last(ResearchResult.class)).thenReturn(new ResearchResult(List.of(), List.of(), List.of()));
        when(blackboard.last(GraphOutcome.class)).thenReturn(new GraphOutcome(new GraphData(List.of(), List.of()), List.of()));

        assertEquals("COMPLETED", finishing.status("p1").status());
        assertEquals("COMPLETED", finishing.status("p1").status());

        verify(events, times(1)).recordFinish(eq("p1"), eq("COMPLETED"), any());
    }

    /** 失敗終態同樣只回寫一次。 */
    @Test void statusRecordsFinishOnceWhenFailed() {
        var events = mock(UsageEventStore.class);
        var finishing = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);
        finishing.start("x", Locale.EN, List.of());
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.KILLED);

        assertEquals("FAILED", finishing.status("p1").status());
        finishing.status("p1");

        verify(events, times(1)).recordFinish(eq("p1"), eq("FAILED"), any());
    }

    /** 執行中不得回寫終態。 */
    @Test void statusDoesNotRecordFinishWhileRunning() {
        var events = mock(UsageEventStore.class);
        var running = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);
        running.start("x", Locale.EN, List.of());
        running.status("p1");
        verify(events, never()).recordFinish(anyString(), anyString(), any());
    }

    /** case_event 寫入失敗不得讓狀態查詢壞掉。 */
    @Test void statusSurvivesEventStoreFailure() {
        var events = mock(UsageEventStore.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down"))
                .when(events).recordFinish(anyString(), anyString(), any());
        var finishing = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);
        finishing.start("x", Locale.EN, List.of());
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.KILLED);
        assertEquals("FAILED", finishing.status("p1").status());
    }

    /** 啟動事件必須在 platform.start 之前寫入，否則流程一開跑的 token／終態回寫會找不到列。 */
    @Test void recordsStartEventBeforeStartingProcess() {
        var events = mock(UsageEventStore.class);
        var starting = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);

        starting.start("A hit B", Locale.ZH_TW, List.of(), "", new CaseStartContext("member", "g-1", "gpt-5.4-nano"));

        var order = org.mockito.Mockito.inOrder(events, platform);
        order.verify(events).recordStart(org.mockito.ArgumentMatchers.argThat(e ->
                "p1".equals(e.caseId()) && "case".equals(e.mode()) && "member".equals(e.identityKind())
                        && "g-1".equals(e.identityHash()) && "gpt-5.4-nano".equals(e.model())
                        && "RUNNING".equals(e.status()) && e.startedAt() != null && e.finishedAt() == null));
        order.verify(platform).start(process);
    }

    /** 未帶統計脈絡的舊呼叫端仍會留下事件，模型以 default 記錄。 */
    @Test void legacyStartStillRecordsAnonymousEvent() {
        var events = mock(UsageEventStore.class);
        var starting = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);

        starting.start("A hit B", Locale.EN, List.of());

        verify(events).recordStart(org.mockito.ArgumentMatchers.argThat(e ->
                "anonymous".equals(e.identityKind()) && "unknown".equals(e.identityHash())
                        && "default".equals(e.model())));
    }

    /** case_event 寫入失敗不得讓案件無法啟動（統計不能擋流程）。 */
    /** 啟動事件寫不進去等於配額不計次，必須直接拒絕啟動，流程不得開跑。 */
    @Test void startFailsWhenEventStoreUnavailable() {
        var events = mock(UsageEventStore.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down"))
                .when(events).recordStart(any(tw.lawgraph.usage.CaseEvent.class));
        var starting = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)), events);

        assertThrows(QuotaStoreUnavailableException.class, () -> starting.start("A hit B", Locale.EN, List.of()));
        verify(platform, never()).start(process);
    }

    /** 沒有人輪詢 status() 的已完成案件，巡檢時也要回寫終態，且只寫一次。 */
    @Test void sweepRecordsFinishForCompletedCaseWithoutStatusPolling() {
        var events = mock(UsageEventStore.class);
        var sweeping = new CaseService(platform, new StepWatchdog(Duration.ofSeconds(300)),
                Clock.fixed(Instant.parse("2026-09-05T02:00:00Z"), ZoneOffset.UTC), events);
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.RUNNING);
        sweeping.start("A hit B", Locale.EN, List.of());

        when(process.getStatus()).thenReturn(AgentProcessStatusCode.COMPLETED);
        sweeping.sweep();
        verify(events, times(1)).recordFinish(eq("p1"), eq("COMPLETED"), any(Instant.class));

        sweeping.sweep();
        verify(events, times(1)).recordFinish(anyString(), anyString(), any(Instant.class));
    }
}
