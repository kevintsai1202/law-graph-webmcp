package tw.lawgraph.agent;

import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

/** 讓流程停在 WAITING、等待人類回答頭腦風暴提問的等待物件。 */
public final class QuestionsAwaitable extends BaseQuestionsAwaitable<UserAnswers> {
    /** 建立包含待答問題與空答案 payload 的等待物件。 */
    public QuestionsAwaitable(List<Question> questions) {
        super(questions, new UserAnswers(List.of()), UserAnswers::new);
    }
}
