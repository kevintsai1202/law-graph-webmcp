package tw.lawgraph.api;

/**
 * 刪除帳號時，使用事件的去識別化失敗所拋出。
 * 必須先確定事件已去識別化才刪會員列，否則會留下可識別的孤兒事件，因此這裡明確失敗（503）而非回 204。
 */
public class AccountDeletionException extends RuntimeException {
    /** 以原始錯誤建立；訊息供 API 回應顯示。 */
    public AccountDeletionException(Throwable cause) {
        super("刪除帳號時無法清除使用紀錄（儲存暫時無法使用），請稍後再試；您的資料未被部分刪除。", cause);
    }
}
