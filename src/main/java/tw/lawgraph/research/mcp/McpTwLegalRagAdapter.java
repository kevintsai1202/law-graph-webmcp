package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import tw.lawgraph.research.JudgmentCandidate;
import tw.lawgraph.research.JudgmentIdNormalizer;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.ResearchSource;
import tw.lawgraph.research.TwLegalRagPort;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 將通過 M0 schema 閘門設定的 tw-legal-rag search_bundle 轉成語意判決候選。 */
public final class McpTwLegalRagAdapter implements TwLegalRagPort {
    /** production tw-legal-rag search_bundle 的 query 字數上限（超過會回 JSON-RPC -32602 string_too_long）。 */
    public static final int MAX_QUERY_CHARS = 500;
    /** 截斷時優先回退到的句尾符號。 */
    private static final String SENTENCE_ENDINGS = "。！？；\n";

    private final McpSyncClient client;
    private final String searchTool;
    private final String queryField;

    /** 使用 M0 預期工具名與 query 欄位建立 adapter；啟用前仍須通過 tools/list 閘門。 */
    public McpTwLegalRagAdapter(McpSyncClient client) {
        this(client, "search_bundle", "query");
    }

    /** 允許以已驗證 fixture 的實際名稱／欄位建立 adapter。 */
    public McpTwLegalRagAdapter(McpSyncClient client, String searchTool, String queryField) {
        if (client == null) throw new IllegalArgumentException("tw-legal-rag client is required");
        this.client = client;
        this.searchTool = searchTool == null || searchTool.isBlank() ? "search_bundle" : searchTool.trim();
        this.queryField = queryField == null || queryField.isBlank() ? "query" : queryField.trim();
    }

    /** 執行語意 bundle；空白案情不呼叫遠端 MCP。 */
    @Override
    public SemanticResearch retrieve(ResearchPlan plan) {
        if (!plan.hasSemanticQuery()) return new SemanticResearch(List.of());
        try {
            McpSchema.CallToolResult result = client.callTool(new McpSchema.CallToolRequest(
                    searchTool, Map.of(queryField, truncateQuery(plan.semanticCaseText()))));
            Object payload = McpPayloadSupport.payload(result, searchTool);
            Set<String> allowed = new HashSet<>(McpPayloadSupport.allowedCitations(payload));
            List<JudgmentCandidate> candidates = McpPayloadSupport.records(payload,
                            "candidates", "judgments", "results", "documents", "items", "data").stream()
                    .map(map -> toCandidate(map, allowed)).toList();
            return new SemanticResearch(candidates);
        } catch (McpResearchException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw McpResearchException.classify(searchTool, exception);
        }
    }

    /** 將案情文字限制在 provider 上限內；超過時盡量在句尾截斷，避免送出半句造成語意失真。 */
    public static String truncateQuery(String text) {
        if (text == null || text.length() <= MAX_QUERY_CHARS) return text;
        String head = text.substring(0, MAX_QUERY_CHARS);
        int cut = -1;
        for (int i = head.length() - 1; i >= MAX_QUERY_CHARS / 2; i--) {
            if (SENTENCE_ENDINGS.indexOf(head.charAt(i)) >= 0) {
                cut = i;
                break;
            }
        }
        return (cut > 0 ? head.substring(0, cut + 1) : head).trim();
    }

    /** 將語意候選轉為含 citation allowlist 與全文驗證狀態的 domain 候選。 */
    private static JudgmentCandidate toCandidate(Map<String, Object> map, Set<String> allowed) {
        String rawId = McpPayloadSupport.text(map, "doc_id", "jid", "case_id", "id");
        String citation = McpPayloadSupport.text(map, "citation", "citation_text", "citationText",
                "case_no", "title", "case_id");
        String citationId = McpPayloadSupport.text(map, "citation_id", "citationId");
        String fullText = McpPayloadSupport.text(map, "full_text", "fullText", "fulltext_excerpt", "content", "text");
        boolean allowlisted = !allowed.isEmpty() && (allowed.contains(rawId)
                || allowed.contains(citation) || allowed.contains(citationId));
        boolean fullTextVerified = McpPayloadSupport.bool(map, "full_text_verified") || fullText != null;
        return new JudgmentCandidate(rawId, JudgmentIdNormalizer.canonicalize(rawId), citation,
                McpPayloadSupport.text(map, "court"),
                McpPayloadSupport.text(map, "date", "decision_date"),
                McpPayloadSupport.text(map, "summary", "snippet", "abstract"), fullText,
                McpPayloadSupport.text(map, "url", "citation_url", "source_url", "link"),
                Set.of(ResearchSource.SEMANTIC), null,
                McpPayloadSupport.decimal(map, "score", "semantic_score", "similarity", "relevance"),
                citationId, allowlisted, fullTextVerified);
    }
}
