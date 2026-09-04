package tw.lawgraph.domain;

import java.util.List;

/** 第三輪也是最後一輪的待問問題與累積證據缺口。 */
public record ThirdRoundQuestions(List<Question> questions, List<String> evidenceGaps) {}
