package tw.lawgraph.domain;

import java.util.List;

/** 與 law-powers data.js superset schema 相容的完整圖資料。 */
public record GraphData(List<GraphNode> nodes, List<GraphEdge> edges) {}
