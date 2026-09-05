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
}
