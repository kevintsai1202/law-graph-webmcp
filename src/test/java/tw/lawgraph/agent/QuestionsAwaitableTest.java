package tw.lawgraph.agent;

import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.Blackboard;
import com.embabel.agent.core.hitl.ResponseImpact;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 使用者回答送達後，UserAnswers 必須被放進 blackboard 讓 GOAP 繼續規劃。 */
class QuestionsAwaitableTest {

    /** 驗證回覆會綁定成 UserAnswers，且 payload 僅為空答案佔位。 */
    @Test
    void onResponseBindsUserAnswersToBlackboard() {
        var awaitable = new QuestionsAwaitable(List.of(new Question("q1", "Dashcam?", "causation")));
        var blackboard = mock(Blackboard.class);
        var process = mock(AgentProcess.class);
        when(process.getBlackboard()).thenReturn(blackboard);

        var impact = awaitable.onResponse(
                new AnswersResponse(awaitable.getId(), List.of(new Answer("q1", "yes"))), process);

        assertEquals(ResponseImpact.UPDATED, impact);
        verify(blackboard).addObject(new UserAnswers(List.of(new Answer("q1", "yes"))));
        assertEquals(1, awaitable.questions().size());
        assertTrue(awaitable.getPayload().answers().isEmpty(), "payload 只是佔位，真正答案由 onResponse 寫入");
    }
}
