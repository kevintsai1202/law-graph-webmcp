package tw.lawgraph.domain;

import java.util.List;

/** 使用者提交的一組澄清答案。 */
public record UserAnswers(List<Answer> answers) {}
