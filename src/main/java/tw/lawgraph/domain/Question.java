package tw.lawgraph.domain;

/** 系統需要由使用者親自回答的澄清問題。 */
public record Question(String id, String text, String why) {}
