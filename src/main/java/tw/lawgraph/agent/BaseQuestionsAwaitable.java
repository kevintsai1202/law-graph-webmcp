package tw.lawgraph.agent;

import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.hitl.AbstractAwaitable;
import com.embabel.agent.core.hitl.ResponseImpact;
import org.jetbrains.annotations.NotNull;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.Question;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

/** 多輪澄清共用等待物件；以不同 payload 型別確保 GOAP 不會把不同輪答案混為同一產物。 */
public abstract class BaseQuestionsAwaitable<T> extends AbstractAwaitable<T, AnswersResponse> {
    private final List<Question> questions;
    private final Function<List<Answer>, T> answerFactory;

    /** 建立指定輪次的問題、空 payload 與答案轉換器。 */
    protected BaseQuestionsAwaitable(List<Question> questions, T emptyPayload, Function<List<Answer>, T> answerFactory) {
        super(emptyPayload, UUID.randomUUID().toString(), Instant.now(), false);
        this.questions = List.copyOf(questions);
        this.answerFactory = answerFactory;
    }

    /** 回傳這一輪顯示給使用者的問題。 */
    public List<Question> questions() { return questions; }

    /** 將答案轉成該輪獨立領域型別後寫入 blackboard。 */
    @NotNull
    @Override
    public ResponseImpact onResponse(@NotNull AnswersResponse response, @NotNull AgentProcess agentProcess) {
        agentProcess.getBlackboard().addObject(answerFactory.apply(response.answers()));
        return ResponseImpact.UPDATED;
    }
}
