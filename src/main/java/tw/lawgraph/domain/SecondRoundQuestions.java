package tw.lawgraph.domain;

import java.util.List;

/** 第二輪待問問題與截至目前已確認無法取得的證據缺口。 */
public record SecondRoundQuestions(List<Question> questions, List<String> evidenceGaps) {}
