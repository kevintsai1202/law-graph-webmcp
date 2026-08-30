package tw.lawgraph.domain;

/** 3D 法律關係圖的有向連線。 */
public record GraphEdge(String from, String to, String label, String title, String rel) {}
