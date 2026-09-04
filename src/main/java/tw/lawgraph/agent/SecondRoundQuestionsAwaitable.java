package tw.lawgraph.agent;

import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.SecondRoundAnswers;

import java.util.List;

/** 第二輪澄清等待物件。 */
public final class SecondRoundQuestionsAwaitable extends BaseQuestionsAwaitable<SecondRoundAnswers> {
    /** 建立第二輪問題與空答案 payload。 */
    public SecondRoundQuestionsAwaitable(List<Question> questions) {
        super(questions, new SecondRoundAnswers(List.of()), SecondRoundAnswers::new);
    }
}
