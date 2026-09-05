package tw.lawgraph.api;

/**
 * 啟動案件時的統計脈絡：呼叫端身分類別（member／anonymous）、身分識別（會員 sub 或匿名 IP 雜湊）與模型名稱。
 * 由 API 層決定後傳給 CaseService，於流程啟動前寫入 case_event，確保後續 token 與終態回寫都有列可更新。
 */
public record CaseStartContext(String identityKind, String identityHash, String model) {
    /** 未帶身分資訊的預設脈絡（相容舊呼叫端與單元測試）。 */
    public static CaseStartContext anonymous(String model) {
        return new CaseStartContext("anonymous", "unknown", model == null ? "" : model);
    }
}
