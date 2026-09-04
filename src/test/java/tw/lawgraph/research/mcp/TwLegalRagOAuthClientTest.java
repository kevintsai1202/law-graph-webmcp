package tw.lawgraph.research.mcp;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 驗證 OAuth metadata discovery、dynamic registration 與 PKCE start，不連接真實授權帳號。 */
class TwLegalRagOAuthClientTest {
    private HttpServer server;
    /** 每個測試獨立的 session 目錄，避免測試憑證污染專案工作樹。 */
    @TempDir
    Path tempDir;

    /** 停止測試用 metadata server，避免測試結束後殘留 HTTP thread。 */
    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    /** start 應讀取 protected-resource metadata、註冊 public client 並產生 S256 授權 URL。 */
    @Test
    void discoversMetadataRegistersClientAndBuildsPkceUrl() throws Exception {
        AtomicReference<String> registrationBody = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        json(server, "/.well-known/oauth-protected-resource",
                "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base
                        + "\"],\"scopes_supported\":[\"judgments:read\"]}");
        json(server, "/.well-known/oauth-authorization-server",
                "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                        + "/oauth/authorize\",\"token_endpoint\":\"" + base
                        + "/oauth/token\",\"registration_endpoint\":\"" + base
                        + "/oauth/register\",\"code_challenge_methods_supported\":[\"S256\"]}");
        server.createContext("/oauth/register", exchange -> {
            registrationBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 201, "{\"client_id\":\"test-client\"}");
        });
        server.start();

        var properties = new TwLegalRagOAuthProperties(true, base, "/mcp", "search_bundle", "query",
                "https://law-graph-webmcp.zeabur.app", "test-client", Duration.ofSeconds(2), Duration.ofSeconds(30));
        var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient());
        try {
            TwLegalRagOAuthClient.AuthorizationStart start = client.startAuthorization("/result");
            Map<String, String> query = query(start.authorizationUri());

            assertEquals(base + "/oauth/authorize", start.authorizationUri().getScheme() + "://"
                    + start.authorizationUri().getAuthority() + start.authorizationUri().getPath());
            assertEquals("test-client", query.get("client_id"));
            assertEquals("S256", query.get("code_challenge_method"));
            assertEquals("judgments:read", query.get("scope"));
            assertEquals(base + "/mcp", query.get("resource"));
            assertNotNull(query.get("state"));
            assertNotNull(query.get("code_challenge"));
            assertTrue(registrationBody.get().contains("\"redirect_uris\""));
            assertTrue(registrationBody.get().contains("/api/auth/tw-legal-rag/callback"));
        } finally {
            client.close();
        }
    }

    /** callback 應交換 token、以 Bearer 初始化 MCP／tools/list，之後可用同一 session 呼叫 search_bundle。 */
    @Test
    void callbackExchangesTokenInitializesMcpAndReconnectsResearch() throws Exception {
        AtomicReference<String> tokenForm = new AtomicReference<>();
        AtomicReference<String> authorizationHeader = new AtomicReference<>();
        AtomicReference<String> lastMcpRequest = new AtomicReference<>();
        AtomicReference<String> firstMcpRequest = new AtomicReference<>();
        AtomicInteger mcpRequests = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        json(server, "/.well-known/oauth-protected-resource",
                "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base
                        + "\"],\"scopes_supported\":[\"judgments:read\"]}");
        json(server, "/.well-known/oauth-authorization-server",
                "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                        + "/oauth/authorize\",\"token_endpoint\":\"" + base
                        + "/oauth/token\",\"registration_endpoint\":\"" + base
                        + "/oauth/register\",\"code_challenge_methods_supported\":[\"S256\"]}");
        server.createContext("/oauth/register", exchange -> respond(exchange, 201,
                "{\"client_id\":\"test-client\"}"));
        server.createContext("/oauth/token", exchange -> {
            tokenForm.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"access_token\":\"access-secret\",\"refresh_token\":\"refresh-secret\","
                    + "\"expires_in\":600}");
        });
        server.createContext("/mcp", exchange -> {
            mcpRequests.incrementAndGet();
            authorizationHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            lastMcpRequest.set(request);
            firstMcpRequest.compareAndSet(null, request);
            String id = jsonRpcId(request);
            if (request.contains("\"method\":\"initialize\"")) {
                exchange.getResponseHeaders().set("Mcp-Session-Id", "test-session");
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18",
                        "capabilities":{"tools":{}},"serverInfo":{"name":"test","version":"1.0"}}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"tools/list\"")) {
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"search_bundle",
                        "description":"test","inputSchema":{"type":"object","properties":{"query":{"type":"string"}}}}]}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"notifications/initialized\"")) {
                respond(exchange, 202, "");
            } else if (request.contains("\"method\":\"tools/call\"")) {
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"{\\\"allowed_citations\\\":[\\\"RAG-1\\\"],\\\"candidates\\\":[{\\\"doc_id\\\":\\\"RAG-1\\\",\\\"citation\\\":\\\"測試判決\\\"}]}"}]}}
                        """.formatted(id));
            } else {
                respond(exchange, 202, "");
            }
        });
        server.start();

        Path sessionFile = tempDir.resolve("callback-session.json");
        var properties = new TwLegalRagOAuthProperties(true, base, "/mcp", "search_bundle", "query",
                "https://law-graph-webmcp.zeabur.app", "test-client", Duration.ofSeconds(2), Duration.ofSeconds(30),
                sessionFile.toString());
        var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient());
        try {
            TwLegalRagOAuthClient.AuthorizationStart start = client.startAuthorization("/result");
            Map<String, String> query = query(start.authorizationUri());
            TwLegalRagOAuthClient.AuthorizationCompletion completion = client.completeAuthorization(
                    "authorization-code", query.get("state"), null, base);

            assertTrue(completion.authorized(), "MCP requests=" + mcpRequests.get()
                    + ", first request=" + firstMcpRequest.get()
                    + ", last request=" + lastMcpRequest.get());
            assertTrue(client.status().authorized());
            assertTrue(tokenForm.get().contains("code_verifier="));
            assertTrue(tokenForm.get().contains("authorization-code"));
            assertTrue(mcpRequests.get() >= 3, "initialize、initialized、tools/list 應完成");
            assertTrue(Files.isRegularFile(sessionFile), "callback 成功後應原子保存 session 檔案");

            var result = client.retrieve(new tw.lawgraph.research.ResearchPlan(
                    java.util.List.of(), java.util.List.of(), "請找測試判決"));
            assertEquals(1, result.semanticCandidates().size());
            assertEquals("Bearer access-secret", authorizationHeader.get());
        } finally {
            client.close();
        }
    }

    /** 每次 semantic retrieve 都應重新 initialize 一個新的 MCP session，不沿用可能已在伺服器端過期的 session。 */
    @Test
    void reinitializesMcpSessionOnEveryRetrieve() throws Exception {
        AtomicInteger initializeCount = new AtomicInteger();
        java.util.List<String> callSessionIds = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        json(server, "/.well-known/oauth-protected-resource",
                "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base + "\"]}");
        json(server, "/.well-known/oauth-authorization-server",
                "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                        + "/oauth/authorize\",\"token_endpoint\":\"" + base
                        + "/oauth/token\",\"registration_endpoint\":\"" + base
                        + "/oauth/register\",\"code_challenge_methods_supported\":[\"S256\"]}");
        server.createContext("/oauth/register", exchange -> respond(exchange, 201, "{\"client_id\":\"test-client\"}"));
        server.createContext("/oauth/token", exchange -> respond(exchange, 200,
                "{\"access_token\":\"access-secret\",\"refresh_token\":\"refresh-secret\",\"expires_in\":600}"));
        server.createContext("/mcp", exchange -> {
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String id = jsonRpcId(request);
            String sessionId = exchange.getRequestHeaders().getFirst("Mcp-Session-Id");
            if (request.contains("\"method\":\"initialize\"")) {
                exchange.getResponseHeaders().set("Mcp-Session-Id", "session-" + initializeCount.incrementAndGet());
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18",
                        "capabilities":{"tools":{}},"serverInfo":{"name":"test","version":"1.0"}}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"tools/list\"")) {
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"search_bundle",
                        "description":"test","inputSchema":{"type":"object","properties":{"query":{"type":"string"}}}}]}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"tools/call\"")) {
                callSessionIds.add(sessionId);
                // 模擬伺服器只接受最新一次 initialize 發出的 session；舊 session 一律 404。
                if (!("session-" + initializeCount.get()).equals(sessionId)) {
                    respond(exchange, 404, "");
                    return;
                }
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"{\\\"allowed_citations\\\":[\\\"RAG-1\\\"],\\\"candidates\\\":[{\\\"doc_id\\\":\\\"RAG-1\\\",\\\"citation\\\":\\\"測試判決\\\"}]}"}]}}
                        """.formatted(id));
            } else {
                respond(exchange, 202, "");
            }
        });
        server.start();

        var properties = new TwLegalRagOAuthProperties(true, base, "/mcp", "search_bundle", "query",
                "https://law-graph-webmcp.zeabur.app", "test-client", Duration.ofSeconds(2), Duration.ofSeconds(30),
                tempDir.resolve("reinit-session.json").toString());
        var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient());
        try {
            Map<String, String> query = query(client.startAuthorization("/").authorizationUri());
            assertTrue(client.completeAuthorization("authorization-code", query.get("state"), null, base).authorized());
            int afterCallback = initializeCount.get();

            var plan = new tw.lawgraph.research.ResearchPlan(java.util.List.of(), java.util.List.of(), "請找測試判決");
            assertEquals(1, client.retrieve(plan).semanticCandidates().size());
            assertEquals(1, client.retrieve(plan).semanticCandidates().size());

            assertEquals(afterCallback + 2, initializeCount.get(), "每次 retrieve 都應重新 initialize");
            assertEquals(2, callSessionIds.size());
            assertNotEquals(callSessionIds.get(0), callSessionIds.get(1), "兩次 tools/call 應使用不同 session");
            assertTrue(client.status().authorized(), "重新 initialize 不應影響 OAuth 授權狀態");
        } finally {
            client.close();
        }
    }

    /** token endpoint 暫時 5xx 時保留 refresh token，讓背景恢復可於下次啟動重試。 */
    @Test
    void keepsSessionFileWhenRestoreEndpointIsUnavailable() throws Exception {
        Path sessionFile = tempDir.resolve("unavailable-session.json");
        Files.writeString(sessionFile, "{\"client_id\":\"saved-client\",\"refresh_token\":\"saved-refresh\"}");
        String base = startRestoreServer(503);
        var properties = properties(base, sessionFile);

        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient())) {
            assertFalse(client.tryRestoreSession());
            assertTrue(Files.isRegularFile(sessionFile), "5xx 不得刪除仍可能有效的 refresh token");
        }
    }

    /** token endpoint 明確拒絕 refresh token 時刪除失效 session，下一次應要求重新授權。 */
    @Test
    void removesSessionFileWhenRefreshTokenIsRejected() throws Exception {
        Path sessionFile = tempDir.resolve("rejected-session.json");
        Files.writeString(sessionFile, "{\"client_id\":\"saved-client\",\"refresh_token\":\"expired-refresh\"}");
        String base = startRestoreServer(401);
        var properties = properties(base, sessionFile);

        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient())) {
            assertFalse(client.tryRestoreSession());
            assertFalse(Files.exists(sessionFile), "401 代表憑證失效，應清除 session 檔案");
        }
    }

    /** 建立只供 session restore 測試使用的 OAuth metadata 與指定狀態 token endpoint。 */
    private String startRestoreServer(int tokenStatus) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        json(server, "/.well-known/oauth-protected-resource",
                "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base + "\"]}");
        json(server, "/.well-known/oauth-authorization-server",
                "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                        + "/oauth/authorize\",\"token_endpoint\":\"" + base
                        + "/oauth/token\",\"registration_endpoint\":\"" + base + "/oauth/register\"}");
        server.createContext("/oauth/token", exchange -> respond(exchange, tokenStatus, "{}"));
        server.start();
        return base;
    }

    /** 建立指向測試 session 檔的 OAuth 設定。 */
    private static TwLegalRagOAuthProperties properties(String base, Path sessionFile) {
        return new TwLegalRagOAuthProperties(true, base, "/mcp", "search_bundle", "query",
                "https://law-graph-webmcp.zeabur.app", "test-client", Duration.ofSeconds(2), Duration.ofSeconds(30),
                sessionFile.toString());
    }

    /** tryRestoreSession 應讀取本地 session 檔案、以 refresh_token 交換新 token 並初始化 MCP client。 */
    @Test
    void restoresSessionFromFileAndConnectsMcp() throws Exception {
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("tlr-session-", ".json");
        try {
            java.nio.file.Files.writeString(tempFile, """
                    {"client_id":"saved-client","refresh_token":"saved-refresh-token"}
                    """);
            AtomicReference<String> tokenForm = new AtomicReference<>();
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            json(server, "/.well-known/oauth-protected-resource",
                    "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base
                            + "\"],\"scopes_supported\":[\"judgments:read\"]}");
            json(server, "/.well-known/oauth-authorization-server",
                    "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                            + "/oauth/authorize\",\"token_endpoint\":\"" + base
                            + "/oauth/token\",\"registration_endpoint\":\"" + base
                            + "/oauth/register\",\"code_challenge_methods_supported\":[\"S256\"]}");
            server.createContext("/oauth/token", exchange -> {
                tokenForm.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                respond(exchange, 200, "{\"access_token\":\"restored-access-token\",\"refresh_token\":\"next-refresh-token\","
                        + "\"expires_in\":600}");
            });
            server.createContext("/mcp", exchange -> {
                String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String id = jsonRpcId(request);
                if (request.contains("\"method\":\"initialize\"")) {
                    respond(exchange, 200, """
                            {"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18",
                            "capabilities":{"tools":{}},"serverInfo":{"name":"test","version":"1.0"}}}
                            """.formatted(id));
                } else if (request.contains("\"method\":\"tools/list\"")) {
                    respond(exchange, 200, """
                            {"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"search_bundle",
                            "description":"test","inputSchema":{"type":"object","properties":{"query":{"type":"string"}}}}]}}
                            """.formatted(id));
                } else {
                    respond(exchange, 202, "");
                }
            });
            server.start();

            var properties = new TwLegalRagOAuthProperties(true, base, "/mcp", "search_bundle", "query",
                    "https://law-graph-webmcp.zeabur.app", "test-client", Duration.ofSeconds(2), Duration.ofSeconds(30),
                    tempFile.toString());
            var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient());
            try {
                boolean restored = client.tryRestoreSession();
                assertTrue(restored, "Session 應成功從檔案恢復");
                assertTrue(client.status().authorized());
                assertTrue(tokenForm.get().contains("grant_type=refresh_token"));
                assertTrue(tokenForm.get().contains("refresh_token=saved-refresh-token"));
                assertTrue(tokenForm.get().contains("client_id=saved-client"));
            } finally {
                client.close();
            }
        } finally {
            java.nio.file.Files.deleteIfExists(tempFile);
        }
    }

    /**
     * TLR 的 authorize 端點對已註冊 client 自動同意並 302 回 callback：
     * 程式應能不經瀏覽器自行走完 start → authorize → callback，達到零互動授權。
     */
    @Test
    void autoAuthorizesWithoutBrowserWhenProviderAutoConsents() throws Exception {
        AtomicReference<String> tokenForm = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        oauthMetadata(base);
        server.createContext("/oauth/register", exchange -> respond(exchange, 201, "{\"client_id\":\"test-client\"}"));
        server.createContext("/oauth/authorize", exchange -> {
            // 模擬自動同意：把 state 原封帶回 redirect_uri，並附上一次性 code
            Map<String, String> query = query(exchange.getRequestURI());
            exchange.getResponseHeaders().set("Location", query.get("redirect_uri")
                    + "?code=auto-code&state=" + query.get("state") + "&iss=" + java.net.URLEncoder.encode(base, StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/oauth/token", exchange -> {
            tokenForm.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"access_token\":\"auto-access\",\"refresh_token\":\"auto-refresh\",\"expires_in\":600}");
        });
        mcpServer();
        server.start();

        var store = new InMemorySessionStore();
        var properties = properties(base, tempDir.resolve("unused.json"));
        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient(), store)) {
            assertTrue(client.tryAutoAuthorize(), "authorize 302 回 callback 時應自動完成授權");
            assertTrue(client.status().authorized());
            assertTrue(tokenForm.get().contains("code=auto-code"));
            assertEquals("auto-refresh", store.saved.get().refreshToken(), "refresh token 應寫入注入的 store");

            var plan = new tw.lawgraph.research.ResearchPlan(java.util.List.of(), java.util.List.of(), "請找測試判決");
            assertEquals(1, client.retrieve(plan).semanticCandidates().size());
        }
    }

    /** 尚未授權就直接 retrieve：應先自動授權再檢索，而不是丟 AUTH 要使用者按按鈕。 */
    @Test
    void retrieveAutoAuthorizesWhenSessionMissing() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        oauthMetadata(base);
        server.createContext("/oauth/register", exchange -> respond(exchange, 201, "{\"client_id\":\"test-client\"}"));
        server.createContext("/oauth/authorize", exchange -> {
            Map<String, String> query = query(exchange.getRequestURI());
            exchange.getResponseHeaders().set("Location", query.get("redirect_uri") + "?code=auto-code&state=" + query.get("state"));
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/oauth/token", exchange -> respond(exchange, 200,
                "{\"access_token\":\"auto-access\",\"refresh_token\":\"auto-refresh\",\"expires_in\":600}"));
        mcpServer();
        server.start();

        var properties = properties(base, tempDir.resolve("retrieve-auto.json"));
        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient(), new InMemorySessionStore())) {
            assertFalse(client.status().authorized());
            var plan = new tw.lawgraph.research.ResearchPlan(java.util.List.of(), java.util.List.of(), "請找測試判決");
            assertEquals(1, client.retrieve(plan).semanticCandidates().size());
            assertTrue(client.status().authorized());
        }
    }

    /** provider 回同意頁（200）而非 302 時，自動授權應放棄並保留人工授權路徑，不得誤判成功。 */
    @Test
    void autoAuthorizeGivesUpWhenProviderNeedsHumanConsent() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        oauthMetadata(base);
        server.createContext("/oauth/register", exchange -> respond(exchange, 201, "{\"client_id\":\"test-client\"}"));
        server.createContext("/oauth/authorize", exchange -> respond(exchange, 200, "<html>consent</html>"));
        server.start();

        var properties = properties(base, tempDir.resolve("consent.json"));
        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient(), new InMemorySessionStore())) {
            assertFalse(client.tryAutoAuthorize());
            assertFalse(client.status().authorized());
            assertTrue(client.authorizationRequired(), "仍應引導使用者走瀏覽器授權");
        }
    }

    /** 注入 store 時，tryRestoreSession 應從 store 讀 refresh token，而不是本機檔案。 */
    @Test
    void restoresSessionFromInjectedStore() throws Exception {
        AtomicReference<String> tokenForm = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        oauthMetadata(base);
        server.createContext("/oauth/token", exchange -> {
            tokenForm.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"access_token\":\"restored\",\"refresh_token\":\"next-refresh\",\"expires_in\":600}");
        });
        mcpServer();
        server.start();

        var store = new InMemorySessionStore();
        store.save(new OAuthSessionStore.SavedSession("db-client", "db-refresh"));
        var properties = properties(base, tempDir.resolve("ignored.json"));
        try (var client = new TwLegalRagOAuthClient(properties, java.net.http.HttpClient.newHttpClient(), store)) {
            assertTrue(client.tryRestoreSession());
            assertTrue(tokenForm.get().contains("refresh_token=db-refresh"));
            assertTrue(tokenForm.get().contains("client_id=db-client"));
            assertEquals("next-refresh", store.saved.get().refreshToken(), "輪替後的 refresh token 應回寫 store");
        }
    }

    /** 測試用記憶體 store：驗證 client 透過介面而非檔案讀寫 session。 */
    static final class InMemorySessionStore implements OAuthSessionStore {
        final AtomicReference<SavedSession> saved = new AtomicReference<>();
        @Override public java.util.Optional<SavedSession> load() { return java.util.Optional.ofNullable(saved.get()); }
        @Override public void save(SavedSession session) { saved.set(session); }
        @Override public void clear() { saved.set(null); }
        @Override public String name() { return "memory"; }
    }

    /** 建立標準 OAuth metadata 兩個端點（含 S256）。 */
    private void oauthMetadata(String base) {
        json(server, "/.well-known/oauth-protected-resource",
                "{\"resource\":\"" + base + "/mcp\",\"authorization_servers\":[\"" + base
                        + "\"],\"scopes_supported\":[\"judgments:read\"]}");
        json(server, "/.well-known/oauth-authorization-server",
                "{\"issuer\":\"" + base + "\",\"authorization_endpoint\":\"" + base
                        + "/oauth/authorize\",\"token_endpoint\":\"" + base
                        + "/oauth/token\",\"registration_endpoint\":\"" + base
                        + "/oauth/register\",\"code_challenge_methods_supported\":[\"S256\"]}");
    }

    /** 建立最小 MCP 伺服器：initialize、tools/list（含 search_bundle）、tools/call 回一筆候選。 */
    private void mcpServer() {
        server.createContext("/mcp", exchange -> {
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String id = jsonRpcId(request);
            if (request.contains("\"method\":\"initialize\"")) {
                exchange.getResponseHeaders().set("Mcp-Session-Id", "s-" + System.nanoTime());
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18",
                        "capabilities":{"tools":{}},"serverInfo":{"name":"test","version":"1.0"}}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"tools/list\"")) {
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"search_bundle",
                        "description":"test","inputSchema":{"type":"object","properties":{"query":{"type":"string"}}}}]}}
                        """.formatted(id));
            } else if (request.contains("\"method\":\"tools/call\"")) {
                respond(exchange, 200, """
                        {"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"{\\\"allowed_citations\\\":[\\\"RAG-1\\\"],\\\"candidates\\\":[{\\\"doc_id\\\":\\\"RAG-1\\\",\\\"citation\\\":\\\"測試判決\\\"}]}"}]}}
                        """.formatted(id));
            } else {
                respond(exchange, 202, "");
            }
        });
    }

    /** 建立 JSON metadata endpoint。 */
    private static void json(HttpServer server, String path, String body) {
        server.createContext(path, exchange -> respond(exchange, 200, body));
    }

    /** 寫入測試 HTTP response。 */
    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }

    /** 從測試用 JSON-RPC request 取出 numeric／string id，讓 SDK 能對應 response。 */
    private static String jsonRpcId(String request) {
        Matcher matcher = Pattern.compile("\\\"id\\\"\\s*:\\s*(\\\"(?:\\\\\\\\.|[^\\\"])*\\\"|-?\\d+)").matcher(request);
        return matcher.find() ? matcher.group(1) : "1";
    }

    /** 解析授權 URL query，供測試驗證 PKCE 與 resource 欄位。 */
    private static Map<String, String> query(URI uri) {
        Map<String, String> values = new HashMap<>();
        for (String item : uri.getRawQuery().split("&")) {
            String[] pair = item.split("=", 2);
            values.put(java.net.URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                    java.net.URLDecoder.decode(pair.length == 1 ? "" : pair[1], StandardCharsets.UTF_8));
        }
        return values;
    }
}
