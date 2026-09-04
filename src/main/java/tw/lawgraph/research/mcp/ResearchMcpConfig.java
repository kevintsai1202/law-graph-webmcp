package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tw.lawgraph.config.LawGraphDatabase;
import tw.lawgraph.research.DualMcpResearchService;
import tw.lawgraph.research.JudgmentMergeService;
import tw.lawgraph.research.ResearchProperties;
import tw.lawgraph.research.TaiwanLegalDbPort;
import tw.lawgraph.research.TwLegalRagPort;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 建立雙 MCP research beans；語意未授權時仍以安全 port 讓 keyword 流程可啟動。 */
@Configuration
public class ResearchMcpConfig {

    /** 建立純函式 JID merge service。 */
    @Bean
    public JudgmentMergeService judgmentMergeService() {
        return new JudgmentMergeService();
    }

    /** 建立依 server identity 選擇 MCP client 的 registry。 */
    @Bean
    public McpClientRegistry mcpClientRegistry(List<McpSyncClient> clients) {
        return new McpClientRegistry(clients);
    }

    /** 讀取研究 timeout、上限與 feature flag；預設保持 semantic 關閉。 */
    @Bean
    public ResearchProperties researchProperties(
            @Value("${lawgraph.research.keyword-timeout:30s}") Duration keywordTimeout,
            @Value("${lawgraph.research.semantic-timeout:20s}") Duration semanticTimeout,
            @Value("${lawgraph.research.overall-timeout:45s}") Duration overallTimeout,
            @Value("${lawgraph.research.max-judgments:10}") int maxJudgments,
            @Value("${lawgraph.research.semantic-enabled:false}") boolean semanticEnabled) {
        return new ResearchProperties(keywordTimeout, semanticTimeout, overallTimeout, maxJudgments, semanticEnabled);
    }

    /** 建立每次最多兩個研究軌道工作的可關閉 virtual-thread executor。 */
    @Bean(destroyMethod = "close")
    public ExecutorService legalResearchExecutor() {
        return Executors.newFixedThreadPool(2, Thread.ofVirtual().name("lawgraph-mcp-", 0).factory());
    }

    /** 依 identity／工具白名單建立 keyword port；找不到 client 時安全回報 unavailable。 */
    @Bean
    public TaiwanLegalDbPort taiwanLegalDbPort(
            McpClientRegistry registry,
            @Value("${lawgraph.research.keyword-client-name:legal-mcp}") String clientName) {
        return registry.find(clientName, "query_regulation", "search_judgments")
                .<TaiwanLegalDbPort>map(McpTaiwanLegalDbAdapter::new)
                .orElseGet(() -> unavailableKeywordPort());
    }

    /** 建立 semantic OAuth／MCP 的非敏感設定；不在 bean 建立時連線或註冊 client。 */
    @Bean
    public TwLegalRagOAuthProperties twLegalRagOAuthProperties(
            @Value("${lawgraph.research.semantic-enabled:false}") boolean enabled,
            @Value("${lawgraph.research.semantic-url:https://tlr.dr-legal.com.tw}") String baseUrl,
            @Value("${lawgraph.research.semantic-endpoint:/mcp}") String endpoint,
            @Value("${lawgraph.research.semantic-tool:search_bundle}") String tool,
            @Value("${lawgraph.research.semantic-query-field:query}") String queryField,
            @Value("${lawgraph.research.oauth-public-base-url:http://localhost:8080}") String publicBaseUrl,
            @Value("${lawgraph.research.oauth-client-name:law-graph-webmcp}") String clientName,
            @Value("${lawgraph.research.oauth-http-timeout:10s}") Duration httpTimeout,
            @Value("${lawgraph.research.oauth-token-skew:30s}") Duration tokenSkew,
            @Value("${lawgraph.research.oauth-session-path:.data/tw-legal-rag-session.json}") String sessionPath) {
        return new TwLegalRagOAuthProperties(enabled, baseUrl, endpoint, tool, queryField,
                publicBaseUrl, clientName, httpTimeout, tokenSkew, sessionPath);
    }

    /**
     * OAuth refresh token 的持久化方式：db（共用 PostgreSQL，重佈不必重新授權）或 file（本機 JSON，只撐過同容器重啟）。
     * 語意功能關閉時仍建立 file store（不會被讀寫），避免 bean 缺失。
     */
    @Bean
    public OAuthSessionStore twLegalRagSessionStore(
            TwLegalRagOAuthProperties properties,
            LawGraphDatabase database,
            @Value("${lawgraph.research.oauth-session-store:file}") String store) {
        if ("db".equalsIgnoreCase(store) && properties.enabled()) {
            return new JdbcOAuthSessionStore(database.require("lawgraph.research.oauth-session-store"), "tw-legal-rag");
        }
        return new FileOAuthSessionStore(properties.sessionPath());
    }

    /** 建立 lazy semantic OAuth client；bean 建立階段不連線遠端服務。 */
    @Bean(destroyMethod = "close")
    public TwLegalRagOAuthClient twLegalRagOAuthClient(TwLegalRagOAuthProperties properties,
                                                       OAuthSessionStore sessionStore) {
        return new TwLegalRagOAuthClient(properties, sessionStore);
    }

    /**
     * 應用啟動完成後以背景工作恢復 OAuth session：先用持久化的 refresh token，沒有或已失效則直接零互動自動授權。
     * 遠端異常不阻塞健康檢查與 keyword 軌道；兩者都失敗時前端仍會顯示授權按鈕。
     */
    @Bean
    public ApplicationRunner twLegalRagSessionRestorer(TwLegalRagOAuthClient client,
                                                        TwLegalRagOAuthProperties properties,
                                                        ExecutorService executor) {
        return arguments -> {
            if (properties.enabled()) executor.execute(() -> {
                if (!client.tryRestoreSession()) client.tryAutoAuthorize();
            });
        };
    }

    /** 建立不含原始錯誤內容的 keyword unavailable port。 */
    private static TaiwanLegalDbPort unavailableKeywordPort() {
        return plan -> {
            throw new McpResearchException(McpResearchException.Kind.AUTH, "legal-mcp");
        };
    }

    /** 建立由兩軌 port 組成的研究 orchestration service。 */
    @Bean
    public DualMcpResearchService dualMcpResearchService(TaiwanLegalDbPort keywordPort,
                                                         TwLegalRagPort semanticPort,
                                                         JudgmentMergeService mergeService,
                                                         ResearchProperties properties,
                                                         ExecutorService executor) {
        return new DualMcpResearchService(keywordPort, semanticPort, mergeService, properties, executor);
    }
}
