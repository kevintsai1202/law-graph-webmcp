package tw.lawgraph.domain;

import java.util.List;

/** 套用硬規則後的圖與剔除紀錄。 */
public record GraphOutcome(GraphData graph, List<String> notes) {}
