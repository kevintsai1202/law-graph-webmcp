package tw.lawgraph.agent;

import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.hitl.AbstractAwaitable;
import com.embabel.agent.core.hitl.ResponseImpact;
import org.jetbrains.annotations.NotNull;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.UserAnswers;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 讓流程停在 WAITING、等待人類回答頭腦風暴提問的等待物件。 */
public final class QuestionsAwaitable extends AbstractAwaitable<UserAnswers, AnswersResponse> {
    private final List<Question> questions;

    /** 建立包含待答問題與空答案 payload 的等待物件。 */
    public QuestionsAwaitable(List<Question> questions) {
        super(new UserAnswers(List.of()), UUID.randomUUID().toString(), Instant.now(), false);
        this.questions = List.copyOf(questions);
    }

    /** 回傳要呈現給使用者的問題清單。 */
    public List<Question> questions() {
        return questions;
    }

    /** 將人類答案寫入 blackboard，讓 GOAP 繼續規劃。 */
    @NotNull
    @Override
    public ResponseImpact onResponse(@NotNull AnswersResponse response, @NotNull AgentProcess agentProcess) {
        agentProcess.getBlackboard().addObject(new UserAnswers(response.answers()));
        return ResponseImpact.UPDATED;
    }
}
