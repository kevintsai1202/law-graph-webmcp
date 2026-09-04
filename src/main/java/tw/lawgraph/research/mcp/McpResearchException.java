package tw.lawgraph.research.mcp;

import java.util.Locale;

/** MCP adapter 對外的安全錯誤分類，不保存或輸出 token、response body 等敏感內容。 */
public final class McpResearchException extends RuntimeException {

    /** 供 orchestration 決定語意降級與觀測狀態的錯誤類型。 */
    public enum Kind {
        AUTH,
        TIMEOUT,
        UPSTREAM,
        PARSE,
        INTERNAL
    }

    private final Kind kind;
    /** 原始例外的類別名稱鏈（外層 > 內層），只含型別不含訊息，供 log 定位來源。 */
    private final String causeTypes;

    /** 建立不含原始回應內容的安全例外。 */
    public McpResearchException(Kind kind, String operation) {
        this(kind, operation, "");
    }

    /** 建立安全例外並附上原始例外類別鏈。 */
    private McpResearchException(Kind kind, String operation, String causeTypes) {
        super((operation == null || operation.isBlank() ? "MCP operation" : operation)
                + " failed (" + (kind == null ? Kind.INTERNAL : kind).name() + ")");
        this.kind = kind == null ? Kind.INTERNAL : kind;
        this.causeTypes = causeTypes == null ? "" : causeTypes;
    }

    /** 取得原始例外類別鏈；未經 classify 建立時為空字串。 */
    public String causeTypes() {
        return causeTypes;
    }

    /** 取得安全錯誤分類。 */
    public Kind kind() {
        return kind;
    }

    /** 將 SDK／HTTP runtime exception 分類，且不把原始訊息帶入新例外。 */
    public static McpResearchException classify(String operation, RuntimeException cause) {
        Kind kind = Kind.INTERNAL;
        String causeTypes = causeTypes(cause);
        for (Throwable current = cause; current != null; current = current.getCause()) {
            // SDK／reactor 若把已分類例外包在外層 RuntimeException，直接沿用內層 kind。
            if (current instanceof McpResearchException classified) {
                return new McpResearchException(classified.kind(), operation, causeTypes);
            }
            String signal = current.getMessage() == null
                    ? "" : current.getMessage().toLowerCase(Locale.ROOT);
            String type = current.getClass().getName().toLowerCase(Locale.ROOT);
            if (signal.contains("401") || signal.contains("403") || signal.contains("unauthor")
                    || signal.contains("authorization") || signal.contains("forbidden")
                    || type.contains("authorizationexception")) {
                kind = Kind.AUTH;
                break;
            }
            if (signal.contains("timeout") || signal.contains("timed out")
                    || type.contains("timeoutexception")) {
                kind = Kind.TIMEOUT;
                continue;
            }
            if (signal.matches(".*\\b5\\d\\d\\b.*") || signal.contains("service unavailable")) {
                kind = Kind.UPSTREAM;
            }
        }
        return new McpResearchException(kind, operation, causeTypes);
    }

    /** 以「外層 > 內層」串接例外類別簡名，最多 6 層。 */
    private static String causeTypes(Throwable cause) {
        StringBuilder chain = new StringBuilder();
        int depth = 0;
        for (Throwable current = cause; current != null && depth < 6; current = current.getCause(), depth++) {
            if (chain.length() > 0) chain.append(" > ");
            chain.append(current.getClass().getSimpleName());
            if (current.getCause() == current) break;
        }
        return chain.toString();
    }

    /** 建立不暴露 payload 的解析錯誤。 */
    public static McpResearchException parseFailure(String operation) {
        return new McpResearchException(Kind.PARSE, operation);
    }
}
