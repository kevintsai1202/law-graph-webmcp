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

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
}
