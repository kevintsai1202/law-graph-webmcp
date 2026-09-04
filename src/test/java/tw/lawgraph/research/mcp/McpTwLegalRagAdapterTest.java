package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.ResearchSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 驗證 tw-legal-rag 的 bundle allowlist 與語意候選解析。 */
class McpTwLegalRagAdapterTest {

    /** 只有 allowed_citations 內的 doc_id 才能成為可引用語意證據。 */
    @Test
    void parsesBundleAndCitationAllowlist() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("""
                {"allowed_citations":["RAG-1"],"candidates":[
                  {"doc_id":"RAG-1","citation":"最高法院109年度台上字第1號","score":0.93,
                   "summary":"語意摘要","full_text":"完整理由書","citation_id":"C-1"},
                  {"doc_id":"RAG-2","citation":"未列入白名單","score":0.91,"summary":"不要引用"}
                ]}
                """));

        var result = new McpTwLegalRagAdapter(client).retrieve(new ResearchPlan(List.of(), List.of(),
                "甲遭乙撞傷，請找侵權損害賠償判決"));

        assertEquals(2, result.semanticCandidates().size());
        var allowed = result.semanticCandidates().getFirst();
        assertEquals("RAG-1", allowed.rawId());
        assertTrue(allowed.citationAllowed());
        assertTrue(allowed.fullTextVerified());
        assertEquals(.93, allowed.semanticScore());
        assertEquals(ResearchSource.SEMANTIC, allowed.sources().iterator().next());
        assertEquals("query", capturedRequest(client).arguments().keySet().iterator().next());
    }

    /** production semantic 候選以 case_id 提供引用名稱時應保留該欄位。 */
    @Test
    void mapsProductionCaseIdToCitation() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("""
                {"candidates":[{"jid":"TPDV,104,訴,1817,20151127,1",
                "case_id":"臺灣臺北地方法院 104 年度 訴 字第 1817 號民事判決",
                "summary":"車禍損害賠償判決"}]}
                """));

        var result = new McpTwLegalRagAdapter(client).retrieve(new ResearchPlan(List.of(), List.of(),
                "車禍損害賠償過失比例"));

        assertEquals("臺灣臺北地方法院 104 年度 訴 字第 1817 號民事判決",
                result.semanticCandidates().getFirst().citation());
        assertEquals("TPDV,104,訴,1817,20151127,1", result.semanticCandidates().getFirst().rawId());
    }

    /** production bundle 的 citation_text／citation_url／fulltext_excerpt 應轉成可用欄位。 */
    @Test
    void mapsProductionBundleCitationFields() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("""
                {"allowed_citations":["RAG-1"],"judgments":[{"doc_id":"RAG-1",
                "citation_id":"J1","citation_text":"臺灣高等法院 115 年度 上易 字第 6 號民事判決",
                "citation_url":"https://judgment.example.invalid/j1",
                "fulltext_excerpt":"法院理由摘要"}]}
                """));

        var result = new McpTwLegalRagAdapter(client).retrieve(new ResearchPlan(List.of(), List.of(),
                "車禍損害賠償過失比例"));
        var candidate = result.semanticCandidates().getFirst();

        assertEquals("臺灣高等法院 115 年度 上易 字第 6 號民事判決", candidate.citation());
        assertEquals("https://judgment.example.invalid/j1", candidate.url());
        assertEquals("法院理由摘要", candidate.fullText());
        assertTrue(candidate.citationAllowed());
    }

    /** 語意 MCP 401 只轉成安全錯誤種類，不把原始 response body 帶入例外訊息。 */
    @Test
    void classifiesUnauthorizedFailureWithoutLeakingPayload() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenThrow(new RuntimeException("401 Unauthorized token=secret"));

        var exception = assertThrows(McpResearchException.class, () -> new McpTwLegalRagAdapter(client)
                .retrieve(new ResearchPlan(List.of(), List.of(), "案情")));

        assertEquals(McpResearchException.Kind.AUTH, exception.kind());
        assertTrue(!exception.getMessage().contains("secret"));
    }

    /** 取出唯一一次語意請求，驗證 adapter 未自行呼叫 HTTP API。 */
    /** production TLR 的 search_bundle 拒絕超過 500 字的 query（-32602），adapter 必須先截斷。 */
    @Test
    void truncatesLongCaseTextToProviderLimit() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("{\"candidates\":[]}"));
        String sentence = "被告提供帳戶予詐欺集團成員使用，被害人匯款後遭提領一空，爭點為幫助犯之不確定故意。";
        String longText = sentence.repeat(30);
        assertTrue(longText.length() > 1000);

        new McpTwLegalRagAdapter(client).retrieve(new ResearchPlan(List.of(), List.of(), longText));

        String query = String.valueOf(capturedRequest(client).arguments().get("query"));
        assertTrue(query.length() <= McpTwLegalRagAdapter.MAX_QUERY_CHARS,
                "query 長度應不超過 " + McpTwLegalRagAdapter.MAX_QUERY_CHARS + "，實際 " + query.length());
        assertTrue(query.endsWith("。"), "應在句尾截斷以保留完整語意：" + query.substring(query.length() - 10));
        assertTrue(longText.startsWith(query), "截斷後應為原文前綴");
    }

    /** 未超過上限的案情文字不得被改動。 */
    @Test
    void keepsShortCaseTextUntouched() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("{\"candidates\":[]}"));

        new McpTwLegalRagAdapter(client).retrieve(new ResearchPlan(List.of(), List.of(), "車禍損害賠償過失比例"));

        assertEquals("車禍損害賠償過失比例", capturedRequest(client).arguments().get("query"));
    }

    private static McpSchema.CallToolRequest capturedRequest(McpSyncClient client) {
        var request = org.mockito.ArgumentCaptor.forClass(McpSchema.CallToolRequest.class);
        verify(client).callTool(request.capture());
        return request.getValue();
    }

    /** 建立 MCP 純文字回應。 */
    private static McpSchema.CallToolResult text(String payload) {
        return new McpSchema.CallToolResult(List.of(new McpSchema.TextContent(payload)), false, null, Map.of());
    }
}
