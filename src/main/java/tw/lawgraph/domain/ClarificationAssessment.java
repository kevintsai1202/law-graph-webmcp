package tw.lawgraph.domain;

import java.util.List;

/** LLM 對目前事實完整度的判斷；問題只包含仍會改變結果的新缺漏。 */
public record ClarificationAssessment(boolean sufficient, List<Question> questions, List<String> evidenceGaps) {}
