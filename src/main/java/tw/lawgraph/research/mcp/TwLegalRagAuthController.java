package tw.lawgraph.research.mcp;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/** 提供 browser OAuth start、callback 與非敏感授權狀態端點。 */
@RestController
public class TwLegalRagAuthController {
    private final TwLegalRagOAuthClient oauthClient;
    private final TwLegalRagOAuthProperties properties;

    /** 注入 lazy OAuth client 與 feature flag；semantic 關閉時端點不啟動授權。 */
    public TwLegalRagAuthController(TwLegalRagOAuthClient oauthClient,
                                    TwLegalRagOAuthProperties properties) {
        this.oauthClient = oauthClient;
        this.properties = properties;
    }

    /** 建立 OAuth flow 並將瀏覽器導向 provider authorization page。 */
    @GetMapping("/api/auth/tw-legal-rag/start")
    public ResponseEntity<Void> start(@RequestParam(required = false, defaultValue = "/") String returnTo) {
        if (!properties.enabled()) return ResponseEntity.notFound().build();
        try {
            URI authorizationUri = oauthClient.startAuthorization(returnTo).authorizationUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(authorizationUri).build();
        } catch (RuntimeException exception) {
            // 不把 metadata／registration response 或任何 OAuth 內容回傳給瀏覽器。
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }

    /** 驗證 OAuth callback 並在成功後重新 initialize semantic MCP client。 */
    @GetMapping("/api/auth/tw-legal-rag/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false, name = "iss") String issuer) {
        TwLegalRagOAuthClient.AuthorizationCompletion completion = oauthClient.completeAuthorization(
                code, state, error, issuer);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(statusLocation(completion.returnTo(), completion.authorized())).build();
    }

    /** 回傳前端可用的授權狀態，不包含 access／refresh token。 */
    @GetMapping("/api/auth/tw-legal-rag/status")
    public TwLegalRagOAuthClient.AuthorizationStatus status() {
        return oauthClient.status();
    }

    /** 將 callback 結果帶回本站相對路徑，避免把 provider 錯誤內容拼入 URL。 */
    private static URI statusLocation(String returnTo, boolean authorized) {
        String target = safeReturnTo(returnTo);
        String separator = target.contains("?") ? "&" : "?";
        try {
            return URI.create(target + separator + "mcpAuth=" + (authorized ? "success" : "error"));
        } catch (IllegalArgumentException exception) {
            return URI.create("/?mcpAuth=" + (authorized ? "success" : "error"));
        }
    }

    /** 再次限制 callback returnTo 為本站相對路徑，防止錯誤實作或測試替身形成 open redirect。 */
    private static String safeReturnTo(String returnTo) {
        if (returnTo == null || returnTo.isBlank() || !returnTo.startsWith("/")
                || returnTo.startsWith("//") || returnTo.contains("\\")) return "/";
        return returnTo;
    }
}
