package tw.lawgraph.domain;

/** 檢索到的裁判；jid 為資料來源識別碼，是硬規則一的比對鍵。 */
public record JudgmentRef(String jid, String citation, String court, String date, String summary, String url) {}
