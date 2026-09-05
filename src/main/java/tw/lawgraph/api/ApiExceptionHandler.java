package tw.lawgraph.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** 統一輸出 error 與 message 欄位的 API 錯誤 JSON。 */
@RestControllerAdvice
public class ApiExceptionHandler {
    /** 建立錯誤 JSON。 */
    public static Map<String, String> error(String code, String message) { return Map.of("error", code, "message", message); }

    /** 將找不到案件轉成 404。 */
    @ExceptionHandler(CaseNotFoundException.class) @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> notFound(CaseNotFoundException exception) {
        return error("CASE_NOT_FOUND", exception.getMessage());
    }

    /** 將非等待狀態回答轉成 409。 */
    @ExceptionHandler(CaseNotWaitingException.class) @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> conflict(CaseNotWaitingException exception) {
        return error("CASE_NOT_WAITING", exception.getMessage());
    }

    /** 配額計數所依賴的統計儲存壞掉時轉成 503，明確告知暫時不可用（不得靜默放行）。 */
    @ExceptionHandler(QuotaStoreUnavailableException.class) @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Map<String, String> quotaStoreUnavailable(QuotaStoreUnavailableException exception) {
        return error("QUOTA_STORE_UNAVAILABLE", exception.getMessage());
    }

    /** 刪除帳號時去識別化失敗轉成 503：寧可整筆不刪，也不留下可識別的孤兒事件。 */
    @ExceptionHandler(AccountDeletionException.class) @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Map<String, String> accountDeleteFailed(AccountDeletionException exception) {
        return error("ACCOUNT_DELETE_FAILED", exception.getMessage());
    }

    /** 將不支援、損壞或超限的附件轉成 400。 */
    @ExceptionHandler(InvalidAttachmentException.class) @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidAttachment(InvalidAttachmentException exception) {
        return error(exception.code(), exception.getMessage());
    }
}
