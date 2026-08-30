package tw.lawgraph.domain;

/** 使用者提交的案情與要求輸出的語系。 */
public record CaseInput(String text, Locale locale) {}
