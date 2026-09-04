package tw.lawgraph.research.mcp;

import java.net.URI;
import java.time.Duration;

/** tw-legal-rag runtime OAuth 與 lazy MCP client 的非敏感設定。 */
public record TwLegalRagOAuthProperties(boolean enabled,
                                         String baseUrl,
                                         String endpoint,
                                         String tool,
                                         String queryField,
                                         String publicBaseUrl,
                                         String clientName,
                                         Duration httpTimeout,
                                         Duration tokenSkew,
                                         String sessionPath) {

    /** 向下相容既有 9 參數建構子；使用預設 session 儲存路徑。 */
    public TwLegalRagOAuthProperties(boolean enabled,
                                     String baseUrl,
                                     String endpoint,
                                     String tool,
                                     String queryField,
                                     String publicBaseUrl,
                                     String clientName,
                                     Duration httpTimeout,
                                     Duration tokenSkew) {
        this(enabled, baseUrl, endpoint, tool, queryField, publicBaseUrl, clientName, httpTimeout, tokenSkew,
                ".data/tw-legal-rag-session.json");
    }

    /** 將空白 URL、端點、工具名與不合理 timeout 收斂成安全預設。 */
    public TwLegalRagOAuthProperties {
        baseUrl = normalizeBaseUrl(baseUrl, "https://tlr.dr-legal.com.tw");
        endpoint = normalizeEndpoint(endpoint, "/mcp");
        tool = textOrDefault(tool, "search_bundle");
        queryField = textOrDefault(queryField, "query");
        publicBaseUrl = normalizeBaseUrl(publicBaseUrl, "http://localhost:8080");
        clientName = textOrDefault(clientName, "law-graph-webmcp");
        httpTimeout = safeDuration(httpTimeout, Duration.ofSeconds(10));
        tokenSkew = safeDuration(tokenSkew, Duration.ofSeconds(30));
        sessionPath = textOrDefault(sessionPath, ".data/tw-legal-rag-session.json");
    }

    /** 產生 protected MCP resource URI，供 RFC 8707 resource parameter 使用。 */
    public URI resourceUri() {
        return URI.create(baseUrl + endpoint);
    }

    /** 產生 OAuth callback URI；Zeabur 應以 LAWGRAPH_PUBLIC_BASE_URL 固定公開 origin。 */
    public URI callbackUri() {
        return URI.create(publicBaseUrl + "/api/auth/tw-legal-rag/callback");
    }

    /** 將 URL 正規化成不含尾端斜線的絕對字串。 */
    private static String normalizeBaseUrl(String value, String fallback) {
        String text = textOrDefault(value, fallback).trim();
        while (text.endsWith("/") && text.length() > "https://".length()) {
            text = text.substring(0, text.length() - 1);
        }
        URI uri = URI.create(text);
        if (uri.getScheme() == null || uri.getHost() == null) {
            throw new IllegalArgumentException("OAuth base URL must be absolute");
        }
        return text;
    }

    /** 將端點正規化成單一前導斜線，避免產生 /mcp/mcp 或相對 URL。 */
    private static String normalizeEndpoint(String value, String fallback) {
        String text = textOrDefault(value, fallback).trim();
        return "/" + text.replaceAll("^/+|/+$", "");
    }

    /** 以 fallback 取代 null／空白設定。 */
    private static String textOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    /** 以 fallback 取代 null／非正 timeout。 */
    private static Duration safeDuration(Duration value, Duration fallback) {
        return value == null || value.isZero() || value.isNegative() ? fallback : value;
    }
}
