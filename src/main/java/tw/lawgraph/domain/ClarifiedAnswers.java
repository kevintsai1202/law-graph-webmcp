package tw.lawgraph.domain;

import java.util.List;

/** 最多三輪後彙整的全部答案與仍無法補足的證據缺口。 */
public record ClarifiedAnswers(List<Answer> answers, List<String> evidenceGaps) {}
