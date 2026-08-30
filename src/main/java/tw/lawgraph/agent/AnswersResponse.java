package tw.lawgraph.agent;

import com.embabel.agent.core.hitl.AwaitableResponse;
import org.jetbrains.annotations.NotNull;
import tw.lawgraph.domain.Answer;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 使用者對頭腦風暴提問的回覆；對應某個 QuestionsAwaitable。 */
public final class AnswersResponse implements AwaitableResponse {
    private final String id = UUID.randomUUID().toString();
    private final String awaitableId;
    private final List<Answer> answers;
    private final Instant timestamp = Instant.now();

    /** 建立對應指定等待物件的一組答案。 */
    public AnswersResponse(String awaitableId, List<Answer> answers) {
        this.awaitableId = awaitableId;
        this.answers = List.copyOf(answers);
    }

    /** 回傳不可變的答案清單。 */
    public List<Answer> answers() {
        return answers;
    }

    /** 回傳本次回覆的唯一識別碼。 */
    @NotNull
    @Override
    public String getId() {
        return id;
    }

    /** 回傳此回覆對應的等待物件識別碼。 */
    @NotNull
    @Override
    public String getAwaitableId() {
        return awaitableId;
    }

    /** 回傳答案建立時間。 */
    @NotNull
    @Override
    public Instant getTimestamp() {
        return timestamp;
    }

    /** 回覆只存在目前流程記憶體中，不要求持久化。 */
    @Override
    public boolean persistent() {
        return false;
    }
}
