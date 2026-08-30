package tw.lawgraph.domain;

/** 檢索到的法條；ref 為原文條號，是硬規則一的比對鍵。 */
public record LawRef(String ref, String title, String articleText, String source) {}
