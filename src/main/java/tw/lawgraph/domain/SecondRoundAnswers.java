package tw.lawgraph.domain;

import java.util.List;

/** 使用者對第二輪澄清問題的回答。 */
public record SecondRoundAnswers(List<Answer> answers) {}
