package tw.lawgraph.domain;

/** 當事人準備清單一列：分類（證據文件／人證／程序事項／費用與期限／其他）、項目、為何需要、時限提示。 */
public record ChecklistItem(String category, String item, String why, String dueHint) {}
