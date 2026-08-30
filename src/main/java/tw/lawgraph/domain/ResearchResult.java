package tw.lawgraph.domain;

import java.util.List;

/** 法規與裁判檢索結果，以及檢索或過濾過程的附註。 */
public record ResearchResult(List<LawRef> laws, List<JudgmentRef> judgments, List<String> notes) {}
