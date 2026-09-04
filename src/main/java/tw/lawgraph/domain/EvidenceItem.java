package tw.lawgraph.domain;

/** 舉證責任與證據計畫一列：待證事實、依民訴 §277 由誰舉證、現有證據、缺口、取得方式。 */
public record EvidenceItem(String fact, String burden, String available, String missing, String howToObtain) {}
