package tw.lawgraph.api;

/** 上傳附件無法安全解析或超過限制。 */
public class InvalidAttachmentException extends RuntimeException {
    private final String code;

    /** 建立帶穩定錯誤代碼的附件例外。 */
    public InvalidAttachmentException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** 回傳前端可判讀的穩定錯誤代碼。 */
    public String code() { return code; }
}
