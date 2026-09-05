package tw.lawgraph.api;

/**
 * 每日配額計數所依賴的 case_event 儲存（資料庫）無法查詢時拋出。
 * 配額是共用資源的保護機制，計數壞掉時必須明確失敗（503），不得靜默放行造成無限使用。
 */
public class QuotaStoreUnavailableException extends RuntimeException {
    /** 以原始錯誤建立；訊息供 API 回應顯示。 */
    public QuotaStoreUnavailableException(Throwable cause) {
        super("無法讀取每日配額計數（統計儲存暫時無法使用），請稍後再試。", cause);
    }
}
