package tw.lawgraph.domain;

import java.util.List;

/** 使用者對第三輪澄清問題的回答。 */
public record ThirdRoundAnswers(List<Answer> answers) {}
