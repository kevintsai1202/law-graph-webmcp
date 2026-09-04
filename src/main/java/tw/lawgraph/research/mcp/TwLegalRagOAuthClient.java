package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.TwLegalRagPort;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * tw-legal-rag 的 runtime OAuth client：DCR、PKCE、token refresh 集中於此；每次檢索都重新 initialize MCP session。
 * TLR 的 authorize 端點對已註冊 client 自動同意（302 直接回 callback），因此可由程式自行走完授權（tryAutoAuthorize），
 * 一般情況下使用者不需按任何按鈕；只有 provider 改成需人工同意時才退回瀏覽器授權流程。
 */
public final class TwLegalRagOAuthClient implements TwLegalRagPort, AutoCloseable {
    private static final Logger LOGGER = LoggerFactory.getLogger(TwLegalRagOAuthClient.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String AUTH_REQUIRED_OPERATION = "tw-legal-rag authorization";

    private final TwLegalRagOAuthProperties properties;
    private final HttpClient httpClient;
    private final Map<String, PendingAuthorization> pending = new ConcurrentHashMap<>();
    private final AtomicReference<AuthorizedSession> session = new AtomicReference<>();
    private final Object clientLock = new Object();
    /** refresh token 持久化（file 或 jdbc）；access token 永不落地。 */
    private final OAuthSessionStore store;
    /** 自動授權序列化與退避：連續失敗時 60 秒內不重試，避免每次檢索都打 provider。 */
    private final Object autoAuthorizeLock = new Object();
    private static final Duration AUTO_AUTHORIZE_COOLDOWN = Duration.ofSeconds(60);
    private Instant lastAutoAuthorizeFailure;

    /** 建立使用 JDK HttpClient 的 OAuth client，憑證存本機檔案；不會在建構階段連線遠端 MCP。 */
    public TwLegalRagOAuthClient(TwLegalRagOAuthProperties properties) {
        this(safeProperties(properties), httpClient(properties), null);
    }

    /** 建立使用 JDK HttpClient 的 OAuth client，憑證存指定 store（正式環境為 PostgreSQL）。 */
    public TwLegalRagOAuthClient(TwLegalRagOAuthProperties properties, OAuthSessionStore store) {
        this(safeProperties(properties), httpClient(properties), store);
    }

    /** 提供可替換 HTTP client，供不連外的 controller／OAuth 單元測試使用。 */
    TwLegalRagOAuthClient(TwLegalRagOAuthProperties properties, HttpClient httpClient) {
        this(properties, httpClient, null);
    }

    /** 完整注入；store 為 null 時退回設定路徑的檔案儲存。 */
    TwLegalRagOAuthClient(TwLegalRagOAuthProperties properties, HttpClient httpClient, OAuthSessionStore store) {
        this.properties = safeProperties(properties);
        this.httpClient = httpClient == null ? HttpClient.newHttpClient() : httpClient;
        this.store = store == null ? new FileOAuthSessionStore(this.properties.sessionPath()) : store;
    }

    /** 以關閉語意功能的設定取代 null，避免建構階段發生 NPE。 */
    private static TwLegalRagOAuthProperties safeProperties(TwLegalRagOAuthProperties properties) {
        return properties == null
                ? new TwLegalRagOAuthProperties(false, null, null, null, null, null, null, null, null)
                : properties;
    }

    /** 建立固定 HTTP/1.1 client；MCP Streamable HTTP 不關閉 TLS 驗證。 */
    private static HttpClient httpClient(TwLegalRagOAuthProperties properties) {
        return HttpClient.newBuilder()
                .connectTimeout(safeProperties(properties).httpTimeout())
                .version(HttpClient.Version.HTTP_1_1).build();
    }

    /** 建立一次性 OAuth 授權 URL；state、PKCE verifier 與 callback 目的地只保留在記憶體。 */
    public AuthorizationStart startAuthorization(String returnTo) {
        if (!properties.enabled()) throw new IllegalStateException("semantic OAuth is disabled");
        evictExpiredPending();
        OAuthMetadata metadata = discover();
        Registration registration = register(metadata);
        String state = randomToken(32);
        String verifier = randomToken(48);
        String challenge = base64Url(sha256(verifier));
        String safeReturnTo = safeReturnTo(returnTo);
        pending.put(state, new PendingAuthorization(state, verifier, safeReturnTo, registration,
                Instant.now().plus(Duration.ofMinutes(10))));

        Map<String, String> query = new LinkedHashMap<>();
        query.put("response_type", "code");
        query.put("client_id", registration.clientId());
        query.put("redirect_uri", properties.callbackUri().toString());
        query.put("state", state);
        query.put("code_challenge", challenge);
        query.put("code_challenge_method", "S256");
        if (!metadata.scopes().isEmpty()) query.put("scope", String.join(" ", metadata.scopes()));
        query.put("resource", metadata.resource().toString());
        return new AuthorizationStart(withQuery(metadata.authorizationEndpoint(), query), safeReturnTo);
    }

    /** 驗證 callback state、交換 authorization code，成功後以一次性 MCP session 驗證 tools/list。 */
    public AuthorizationCompletion completeAuthorization(String code, String state, String error, String issuer) {
        PendingAuthorization request = state == null ? null : pending.remove(state);
        if (request == null) return new AuthorizationCompletion("/", false);
        if (error != null && !error.isBlank()) return new AuthorizationCompletion(request.returnTo(), false);
        if (code == null || code.isBlank()) return new AuthorizationCompletion(request.returnTo(), false);
        if (issuer != null && !issuer.isBlank()
                && !sameOrigin(issuer, request.registration().metadata().issuer())) {
            return new AuthorizationCompletion(request.returnTo(), false);
        }

        try {
            Map<String, Object> tokenPayload = postForm(request.registration().metadata().tokenEndpoint(), Map.of(
                    "grant_type", "authorization_code",
                    "code", code,
                    "redirect_uri", properties.callbackUri().toString(),
                    "client_id", request.registration().clientId(),
                    "code_verifier", request.verifier(),
                    "resource", request.registration().metadata().resource().toString()),
                    "oauth token exchange", McpResearchException.Kind.AUTH);
            AuthorizedSession authorized = tokenSession(tokenPayload, request.registration());
            verifyConnection(authorized);
            saveSession(authorized);
            return new AuthorizationCompletion(request.returnTo(), true);
        } catch (RuntimeException ignored) {
            // callback 失敗只回傳不含 token／response body 的狀態，詳細 OAuth 錯誤不進 REST。
            invalidateAuthorization();
            return new AuthorizationCompletion(request.returnTo(), false);
        }
    }

    /** 回傳前端需要的授權狀態，不暴露 access token、refresh token 或註冊資料。 */
    public AuthorizationStatus status() {
        boolean authorized = properties.enabled() && session.get() != null;
        return new AuthorizationStatus(properties.enabled(), authorized,
                properties.enabled() && !authorized, "/api/auth/tw-legal-rag/start");
    }

    /** 研究流程使用的安全旗標；未授權或 token 失效時由 orchestration 顯示 AUTH_REQUIRED。 */
    @Override
    public boolean authorizationRequired() {
        return properties.enabled() && session.get() == null;
    }

    /**
     * 每次檢索都以現有 OAuth token 重新 initialize 一個全新的 MCP session，用完即關。
     * 這避免沿用伺服器端已閒置過期的 Mcp-Session-Id（SDK 會拋 session not found）；
     * 只有 token 本身失效（AUTH）才清除授權，讓前端引導使用者重新授權。
     */
    @Override
    public SemanticResearch retrieve(ResearchPlan plan) {
        // 尚未授權（首次啟動、token 被撤銷）先嘗試零互動授權；provider 需人工同意時才回 AUTH 讓前端引導
        if (session.get() == null && !tryAutoAuthorize()) throw new McpResearchException(
                McpResearchException.Kind.AUTH, AUTH_REQUIRED_OPERATION);
        McpSyncClient client = buildClient();
        try {
            client.initialize();
            return new McpTwLegalRagAdapter(client, properties.tool(), properties.queryField()).retrieve(plan);
        } catch (McpResearchException exception) {
            if (exception.kind() == McpResearchException.Kind.AUTH) invalidateAuthorization();
            throw exception;
        } catch (RuntimeException exception) {
            McpResearchException safe = McpResearchException.classify("tw-legal-rag initialize", exception);
            if (safe.kind() == McpResearchException.Kind.AUTH) invalidateAuthorization();
            throw safe;
        } finally {
            closeQuietly(client);
        }
    }

    /** 清除記憶體內授權；MCP session 皆為一次性，無長連線需關閉（不清除持久化憑證）。 */
    @Override
    public void close() {
        synchronized (clientLock) {
            session.set(null);
        }
    }

    /** 從 protected-resource metadata 與 authorization-server metadata 尋找 OAuth endpoints。 */
    private OAuthMetadata discover() {
        URI resourceMetadataUri = properties.resourceUri().resolve("/.well-known/oauth-protected-resource");
        Map<String, Object> resourcePayload = getJson(resourceMetadataUri, "OAuth protected resource metadata");
        URI resource = URI.create(text(resourcePayload, "resource", properties.resourceUri().toString()));
        List<String> servers = strings(resourcePayload.get("authorization_servers"));
        URI issuer = URI.create(servers.isEmpty() ? properties.baseUrl() : servers.getFirst());
        URI metadataUri = issuer.resolve("/.well-known/oauth-authorization-server");
        Map<String, Object> oauthPayload = getJson(metadataUri, "OAuth authorization server metadata");
        URI authorizationEndpoint = requiredUri(oauthPayload, "authorization_endpoint", "OAuth authorization endpoint");
        URI tokenEndpoint = requiredUri(oauthPayload, "token_endpoint", "OAuth token endpoint");
        URI registrationEndpoint = requiredUri(oauthPayload, "registration_endpoint", "OAuth registration endpoint");
        List<String> scopes = strings(resourcePayload.get("scopes_supported"));
        if (scopes.isEmpty()) scopes = strings(oauthPayload.get("scopes_supported"));
        List<String> challengeMethods = strings(oauthPayload.get("code_challenge_methods_supported"));
        if (!challengeMethods.isEmpty() && challengeMethods.stream().noneMatch("S256"::equalsIgnoreCase)) {
            throw new McpResearchException(McpResearchException.Kind.PARSE, "OAuth PKCE metadata");
        }
        return new OAuthMetadata(resource, issuer, authorizationEndpoint, tokenEndpoint, registrationEndpoint, scopes);
    }

    /** 以 OAuth dynamic client registration 註冊 public PKCE client，不保存 client secret。 */
    private Registration register(OAuthMetadata metadata) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("client_name", properties.clientName());
        payload.put("redirect_uris", List.of(properties.callbackUri().toString()));
        payload.put("grant_types", List.of("authorization_code", "refresh_token"));
        payload.put("response_types", List.of("code"));
        payload.put("token_endpoint_auth_method", "none");
        Map<String, Object> response = postJson(metadata.registrationEndpoint(), payload,
                "OAuth dynamic registration");
        String clientId = text(response, "client_id", null);
        if (clientId == null) throw new McpResearchException(McpResearchException.Kind.PARSE,
                "OAuth dynamic registration");
        return new Registration(clientId, metadata);
    }

    /** 將 authorization code 的 token payload 轉為只存在記憶體的授權 session。 */
    private AuthorizedSession tokenSession(Map<String, Object> payload, Registration registration) {
        String accessToken = text(payload, "access_token", null);
        if (accessToken == null) throw new McpResearchException(McpResearchException.Kind.AUTH, "OAuth access token");
        String refreshToken = text(payload, "refresh_token", "");
        long expiresIn = longValue(payload.get("expires_in"), 300);
        return new AuthorizedSession(accessToken, refreshToken,
                Instant.now().plusSeconds(Math.max(30, expiresIn)), registration);
    }

    /** 以一次性 MCP session 驗證新授權可 initialize 且 tools/list 含所需工具；驗證後即關閉 session。 */
    private void verifyConnection(AuthorizedSession authorized) {
        session.set(authorized);
        McpSyncClient newClient = buildClient();
        try {
            newClient.initialize();
            var tools = newClient.listTools();
            McpSchema.Tool searchTool = tools == null || tools.tools() == null ? null
                    : tools.tools().stream()
                    .filter(tool -> properties.tool().equals(tool.name()))
                    .findFirst().orElse(null);
            if (searchTool == null || !hasInputField(searchTool.inputSchema(), properties.queryField())) {
                throw new McpResearchException(McpResearchException.Kind.PARSE,
                        "tw-legal-rag tools/list");
            }
        } catch (McpResearchException exception) {
            closeQuietly(newClient);
            session.set(null);
            throw exception;
        } catch (RuntimeException exception) {
            closeQuietly(newClient);
            session.set(null);
            throw McpResearchException.classify("tw-legal-rag initialize", exception);
        }
        closeQuietly(newClient);
    }

    /** 建立不在 startup 呼叫 initialize 的 Streamable HTTP client；每次 request 動態讀取 token。 */
    private McpSyncClient buildClient() {
        var transport = HttpClientStreamableHttpTransport.builder(properties.baseUrl())
                .endpoint(properties.endpoint())
                .openConnectionOnStartup(false)
                .connectTimeout(properties.httpTimeout())
                .httpRequestCustomizer((request, method, uri, clientInfo, context) -> {
                    if ("DELETE".equalsIgnoreCase(method)) {
                        // 關閉過期／失效 session 時只使用目前 token，不再觸發 refresh 遞迴。
                        AuthorizedSession current = session.get();
                        if (current != null) {
                            request.setHeader("Authorization", "Bearer " + current.accessToken());
                        }
                        return;
                    }
                    request.setHeader("Authorization", "Bearer " + accessToken());
                })
                .build();
        return McpClient.sync(transport).requestTimeout(properties.httpTimeout()).build();
    }

    /** 驗證 tools/list 的 input schema 具備 adapter 將傳入的 query 欄位。 */
    private static boolean hasInputField(Map<String, Object> inputSchema, String fieldName) {
        if (inputSchema == null || fieldName == null || fieldName.isBlank()) return false;
        Object properties = inputSchema.get("properties");
        if (!(properties instanceof Map<?, ?> fields)) return false;
        return fields.containsKey(fieldName);
    }

    /** 取得仍有效的 access token；過期時以 refresh token 同步更新並供下一個 request 使用。 */
    private String accessToken() {
        AuthorizedSession current = session.get();
        if (current == null) throw new McpResearchException(McpResearchException.Kind.AUTH, AUTH_REQUIRED_OPERATION);
        if (Instant.now().isBefore(current.expiresAt().minus(properties.tokenSkew()))) return current.accessToken();
        if (current.refreshToken().isBlank()) {
            invalidateAuthorization();
            throw new McpResearchException(McpResearchException.Kind.AUTH, AUTH_REQUIRED_OPERATION);
        }
        synchronized (clientLock) {
            current = session.get();
            if (current == null) throw new McpResearchException(McpResearchException.Kind.AUTH, AUTH_REQUIRED_OPERATION);
            if (Instant.now().isBefore(current.expiresAt().minus(properties.tokenSkew()))) return current.accessToken();
            try {
                Map<String, Object> payload = postForm(current.registration().metadata().tokenEndpoint(), Map.of(
                        "grant_type", "refresh_token",
                        "refresh_token", current.refreshToken(),
                        "client_id", current.registration().clientId(),
                        "resource", current.registration().metadata().resource().toString()),
                        "OAuth token refresh", McpResearchException.Kind.AUTH);
                String nextAccessToken = text(payload, "access_token", null);
                if (nextAccessToken == null) throw new McpResearchException(
                        McpResearchException.Kind.AUTH, "OAuth token refresh");
                String nextRefreshToken = text(payload, "refresh_token", current.refreshToken());
                long expiresIn = longValue(payload.get("expires_in"), 300);
                AuthorizedSession refreshed = new AuthorizedSession(nextAccessToken, nextRefreshToken,
                        Instant.now().plusSeconds(Math.max(30, expiresIn)), current.registration());
                session.set(refreshed);
                saveSession(refreshed);
                return nextAccessToken;
            } catch (RuntimeException exception) {
                McpResearchException safe = exception instanceof McpResearchException classified
                        ? classified : McpResearchException.classify("OAuth token refresh", exception);
                if (safe.kind() == McpResearchException.Kind.AUTH) invalidateAuthorization();
                throw safe;
            }
        }
    }

    /**
     * 不經瀏覽器自行走完 OAuth：start → provider authorize → 解析 302 回 callback 的 code/state → 交換 token。
     * 只跟隨 3xx 轉址；provider 回 200（同意頁）或錯誤即放棄並回 false，保留人工授權路徑。
     * 失敗後 60 秒內不再重試，避免每次檢索都打 provider。
     */
    public boolean tryAutoAuthorize() {
        if (!properties.enabled()) return false;
        synchronized (autoAuthorizeLock) {
            if (session.get() != null) return true;
            Instant now = Instant.now();
            if (lastAutoAuthorizeFailure != null && now.isBefore(lastAutoAuthorizeFailure.plus(AUTO_AUTHORIZE_COOLDOWN))) {
                return false;
            }
            try {
                URI location = startAuthorization("/").authorizationUri();
                String callbackPrefix = properties.callbackUri().toString();
                for (int hop = 0; hop < 5; hop++) {
                    HttpRequest request = HttpRequest.newBuilder(location).timeout(properties.httpTimeout()).GET().build();
                    HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                    Optional<String> next = response.headers().firstValue("Location");
                    if (response.statusCode() < 300 || response.statusCode() >= 400 || next.isEmpty()) {
                        LOGGER.info("tw-legal-rag 自動授權未完成：provider 回 {}（可能需人工同意），改由使用者按鈕授權",
                                response.statusCode());
                        lastAutoAuthorizeFailure = now;
                        return false;
                    }
                    URI target = location.resolve(next.get());
                    if (target.toString().startsWith(callbackPrefix)) {
                        Map<String, String> params = queryParams(target);
                        boolean authorized = completeAuthorization(params.get("code"), params.get("state"),
                                params.get("error"), params.get("iss")).authorized();
                        if (authorized) {
                            LOGGER.info("tw-legal-rag 自動授權完成（store={}）", store.name());
                            lastAutoAuthorizeFailure = null;
                        } else {
                            LOGGER.warn("tw-legal-rag 自動授權 callback 未通過（state／token／tools/list 驗證失敗）");
                            lastAutoAuthorizeFailure = now;
                        }
                        return authorized;
                    }
                    location = target;
                }
                LOGGER.info("tw-legal-rag 自動授權轉址超過 5 跳，放棄");
                lastAutoAuthorizeFailure = now;
                return false;
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                lastAutoAuthorizeFailure = now;
                return false;
            } catch (Exception exception) {
                // 不輸出 URL／response，避免 code 或 token 進 log
                LOGGER.warn("tw-legal-rag 自動授權失敗 type={}", exception.getClass().getSimpleName());
                lastAutoAuthorizeFailure = now;
                return false;
            }
        }
    }

    /** 嘗試從持久化 store 恢復 OAuth session：以 refresh token 換新 access token 並驗證 tools/list。 */
    public boolean tryRestoreSession() {
        if (!properties.enabled()) return false;
        Optional<OAuthSessionStore.SavedSession> saved;
        try {
            saved = store.load();
        } catch (RuntimeException exception) {
            // 資料庫暫時不可用：不清除、不視為失效，稍後由 tryAutoAuthorize 或下次啟動再試
            LOGGER.warn("讀取 OAuth session store 失敗 type={}", exception.getClass().getSimpleName());
            return false;
        }
        if (saved.isEmpty()) return false;
        String clientId = saved.get().clientId();
        String refreshToken = saved.get().refreshToken();
        if (clientId == null || clientId.isBlank() || refreshToken == null || refreshToken.isBlank()) {
            clearStoredSession();
            return false;
        }
        try {
            OAuthMetadata metadata = discover();
            Registration registration = new Registration(clientId, metadata);
            Map<String, Object> payload = postForm(metadata.tokenEndpoint(), Map.of(
                    "grant_type", "refresh_token",
                    "refresh_token", refreshToken,
                    "client_id", clientId,
                    "resource", metadata.resource().toString()),
                    "OAuth session restore", McpResearchException.Kind.AUTH);
            AuthorizedSession authorized = tokenSession(payload, registration);
            verifyConnection(authorized);
            saveSession(authorized);
            LOGGER.info("tw-legal-rag OAuth session 已從 {} 恢復", store.name());
            return true;
        } catch (McpResearchException exception) {
            // 只有 token endpoint 明確拒絕憑證才刪除；timeout、5xx 與 metadata 異常保留供下次重試。
            if (exception.kind() == McpResearchException.Kind.AUTH) clearStoredSession();
            return false;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    /** 把 refresh token 與 client_id 回寫 store；沒有 refresh token 時不寫（避免覆蓋仍有效的舊憑證）。 */
    private void saveSession(AuthorizedSession session) {
        if (session == null || session.refreshToken().isBlank()) return;
        try {
            store.save(new OAuthSessionStore.SavedSession(session.registration().clientId(), session.refreshToken()));
        } catch (RuntimeException exception) {
            LOGGER.warn("無法保存 OAuth session（store={}）；目前授權仍可在此程序內使用。錯誤類型={}",
                    store.name(), exception.getClass().getSimpleName());
        }
    }

    /** 清除已失效的持久化憑證。 */
    private void clearStoredSession() {
        try {
            store.clear();
        } catch (RuntimeException ignored) {
        }
    }

    /** 清除失效授權，下一次 semantic research 會先嘗試自動授權，失敗才要求使用者授權。 */
    private void invalidateAuthorization() {
        synchronized (clientLock) {
            session.set(null);
            clearStoredSession();
        }
    }

    /** 解析 callback URL 的 query 參數（code、state、error、iss）。 */
    private static Map<String, String> queryParams(URI uri) {
        Map<String, String> values = new HashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null || raw.isBlank()) return values;
        for (String item : raw.split("&")) {
            String[] pair = item.split("=", 2);
            values.put(java.net.URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                    java.net.URLDecoder.decode(pair.length == 1 ? "" : pair[1], StandardCharsets.UTF_8));
        }
        return values;
    }

    /** 執行 OAuth metadata／registration 的 JSON GET。 */
    private Map<String, Object> getJson(URI uri, String operation) {
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(properties.httpTimeout())
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response = send(request, operation, McpResearchException.Kind.UPSTREAM);
        return object(response.body(), operation);
    }

    /** 執行 dynamic registration 的 JSON POST。 */
    private Map<String, Object> postJson(URI uri, Map<String, Object> payload, String operation) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(properties.httpTimeout())
                    .header("Accept", "application/json").header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(payload))).build();
            HttpResponse<String> response = send(request, operation, McpResearchException.Kind.UPSTREAM);
            return object(response.body(), operation);
        } catch (McpResearchException exception) {
            throw exception;
        } catch (Exception exception) {
            throw McpResearchException.classify(operation, new RuntimeException(exception));
        }
    }

    /** 執行 authorization code／refresh token form POST，錯誤只保留分類。 */
    private Map<String, Object> postForm(URI uri, Map<String, String> form, String operation,
                                         McpResearchException.Kind errorKind) {
        String body = form.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(properties.httpTimeout())
                .header("Accept", "application/json").header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HttpResponse<String> response = send(request, operation, errorKind);
        return object(response.body(), operation);
    }

    /** 執行 HTTP request；不把 status body 帶入例外，避免 OAuth response 洩漏至 log。 */
    private HttpResponse<String> send(HttpRequest request, String operation, McpResearchException.Kind errorKind) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                McpResearchException.Kind kind = response.statusCode() >= 500
                        ? McpResearchException.Kind.UPSTREAM : errorKind;
                throw new McpResearchException(kind, operation);
            }
            return response;
        } catch (McpResearchException exception) {
            throw exception;
        } catch (HttpTimeoutException exception) {
            throw new McpResearchException(McpResearchException.Kind.TIMEOUT, operation);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new McpResearchException(McpResearchException.Kind.TIMEOUT, operation);
        } catch (Exception exception) {
            throw new McpResearchException(McpResearchException.Kind.UPSTREAM, operation);
        }
    }

    /** 將 JSON object 解析成安全的字串 key map；格式錯誤不輸出原始 body。 */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(String body, String operation) {
        try {
            Object value = JSON.readValue(body, Object.class);
            if (!(value instanceof Map<?, ?> raw)) throw new IllegalArgumentException("not object");
            Map<String, Object> result = new HashMap<>();
            raw.forEach((key, item) -> result.put(String.valueOf(key), item));
            return result;
        } catch (RuntimeException exception) {
            throw McpResearchException.parseFailure(operation);
        }
    }

    /** 從 map 取得文字欄位，空白時使用 fallback。 */
    private static String text(Map<String, Object> payload, String key, String fallback) {
        Object value = payload.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    /** 從 metadata 取得必填 URI。 */
    private static URI requiredUri(Map<String, Object> payload, String key, String operation) {
        String value = text(payload, key, null);
        if (value == null) throw new McpResearchException(McpResearchException.Kind.PARSE, operation);
        try {
            return URI.create(value);
        } catch (IllegalArgumentException exception) {
            throw new McpResearchException(McpResearchException.Kind.PARSE, operation);
        }
    }

    /** 將 JSON array 內可轉為文字的值收斂為 immutable list。 */
    private static List<String> strings(Object value) {
        if (!(value instanceof Collection<?> values)) return List.of();
        List<String> result = new ArrayList<>();
        for (Object item : values) if (item != null && !String.valueOf(item).isBlank()) result.add(String.valueOf(item));
        return List.copyOf(result);
    }

    /** 將 expires_in 安全轉成秒數。 */
    private static long longValue(Object value, long fallback) {
        if (value instanceof Number number) return number.longValue();
        try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    /** 移除逾期的一次性 OAuth state。 */
    private void evictExpiredPending() {
        Instant now = Instant.now();
        pending.values().removeIf(item -> now.isAfter(item.expiresAt()));
    }

    /** 限制 OAuth callback 返回路徑為本站相對路徑，避免 open redirect。 */
    private static String safeReturnTo(String returnTo) {
        if (returnTo == null || returnTo.isBlank() || !returnTo.startsWith("/")
                || returnTo.startsWith("//") || returnTo.contains("\\")) return "/";
        return returnTo;
    }

    /** 比較 issuer origin，避免 callback 被其他 OAuth server 偽造。 */
    private static boolean sameOrigin(String actual, URI expected) {
        try {
            URI value = URI.create(actual);
            return expected != null
                    && value.getScheme() != null && expected.getScheme() != null
                    && value.getHost() != null && expected.getHost() != null
                    && value.getScheme().equalsIgnoreCase(expected.getScheme())
                    && value.getHost().equalsIgnoreCase(expected.getHost())
                    && value.getPort() == expected.getPort();
        } catch (RuntimeException exception) {
            return false;
        }
    }

    /** 在既有 query 後加入已編碼參數。 */
    private static URI withQuery(URI endpoint, Map<String, String> query) {
        String encoded = query.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
        String separator = endpoint.getRawQuery() == null ? "?" : "&";
        return URI.create(endpoint + separator + encoded);
    }

    /** UTF-8 percent encode query／form value。 */
    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    /** 產生 URL-safe random bytes。 */
    private static String randomToken(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return base64Url(value);
    }

    /** 產生 PKCE S256 challenge。 */
    private static byte[] sha256(String value) {
        try {
            return java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.US_ASCII));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    /** 將 bytes 編成無 padding 的 URL-safe Base64。 */
    private static String base64Url(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    /** 安全關閉 MCP client；close 錯誤不得覆蓋原始授權狀態。 */
    private static void closeQuietly(McpSyncClient client) {
        if (client == null) return;
        try { client.close(); } catch (RuntimeException ignored) { }
    }

    /** 一次 OAuth start 回應；authorization URI 不含 access／refresh token。 */
    public record AuthorizationStart(URI authorizationUri, String returnTo) { }

    /** OAuth callback 結果；只回傳是否授權成功與安全返回路徑。 */
    public record AuthorizationCompletion(String returnTo, boolean authorized) { }

    /** 前端可見的 OAuth 狀態；不包含任何 credential。 */
    public record AuthorizationStatus(boolean enabled, boolean authorized,
                                      boolean authorizationRequired, String startPath) { }

    /** protected-resource 與 authorization-server metadata 的最小必要欄位。 */
    private record OAuthMetadata(URI resource, URI issuer, URI authorizationEndpoint,
                                 URI tokenEndpoint, URI registrationEndpoint, List<String> scopes) { }

    /** 暫存 DCR client 與 PKCE verifier；逾時後不可再次使用。 */
    private record Registration(String clientId, OAuthMetadata metadata) { }

    /** 單次 callback 的 state、返回路徑與 registration context。 */
    private record PendingAuthorization(String state, String verifier, String returnTo,
                                        Registration registration, Instant expiresAt) { }

    /** 只保留 runtime memory 的 token 與 registration；不覆寫 toString，避免誤記錄 token。 */
    private static final class AuthorizedSession {
        private final String accessToken;
        private final String refreshToken;
        private final Instant expiresAt;
        private final Registration registration;

        /** 保存 token 組合，但不提供可將 credential 輸出的字串表示。 */
        private AuthorizedSession(String accessToken, String refreshToken, Instant expiresAt,
                                  Registration registration) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken == null ? "" : refreshToken;
            this.expiresAt = expiresAt;
            this.registration = registration;
        }

        /** 取得 access token 僅供 request customizer 使用。 */
        private String accessToken() { return accessToken; }

        /** 取得 refresh token 僅供 token refresh form 使用。 */
        private String refreshToken() { return refreshToken; }

        /** 取得過期時間供 refresh 判斷。 */
        private Instant expiresAt() { return expiresAt; }

        /** 取得非敏感 registration endpoint context。 */
        private Registration registration() { return registration; }
    }
}
