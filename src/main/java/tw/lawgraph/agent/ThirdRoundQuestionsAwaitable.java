package tw.lawgraph.agent;

import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ThirdRoundAnswers;

import java.util.List;

/** 第三輪且為最後一輪的澄清等待物件。 */
public final class ThirdRoundQuestionsAwaitable extends BaseQuestionsAwaitable<ThirdRoundAnswers> {
    /** 建立第三輪問題與空答案 payload。 */
    public ThirdRoundQuestionsAwaitable(List<Question> questions) {
        super(questions, new ThirdRoundAnswers(List.of()), ThirdRoundAnswers::new);
    }
}
