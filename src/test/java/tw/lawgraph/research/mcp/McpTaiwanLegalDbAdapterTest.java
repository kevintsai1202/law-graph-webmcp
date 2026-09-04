package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.ResearchSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 驗證 taiwan-legal-db 的查詢參數與回應只在 adapter 層轉換。 */
class McpTaiwanLegalDbAdapterTest {

    /** 法規與關鍵字判決應各自呼叫指定工具，並回傳正規化候選。 */
    @Test
    void mapsLawAndJudgmentQueries() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("""
                {"results":[{"jid":"TPSV,108,台上,2345","citation":"最高法院108年度台上字第2345號",
                "court":"最高法院","date":"2019-05-01","summary":"摘要","url":"https://example.invalid/j"}]}
                """));
        when(client.callTool(new McpSchema.CallToolRequest("query_regulation",
                Map.of("law_name", "民法", "article_no", "184-1")))).thenReturn(text("""
                {"law_name":"民法","article_no":"184-1","article_text":"條文原文"}
                """));

        var plan = new ResearchPlan(List.of("民法第184條第1項"), List.of(
                new ResearchPlan.JudgmentKeywordQuery("車禍 損害賠償", "民事", "最高法院", "", "", 10)), "案情");
        var result = new McpTaiwanLegalDbAdapter(client).retrieve(plan);

        assertEquals(1, result.laws().size());
        assertEquals("民法第184-1條", result.laws().getFirst().ref());
        assertEquals(1, result.keywordCandidates().size());
        assertEquals("TPSV,108,台上,2345", result.keywordCandidates().getFirst().rawId());
        assertTrue(result.keywordCandidates().getFirst().sources().contains(ResearchSource.KEYWORD));
        verify(client).callTool(new McpSchema.CallToolRequest("search_judgments", Map.of(
                "keyword", "車禍 損害賠償", "case_type", "民事", "court", "最高法院", "max_results", 10)));
    }

    /** production search_judgments 以 case_id 提供裁判引用名稱時應保留該欄位。 */
    @Test
    void mapsProductionCaseIdToCitation() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("""
                {"results":[{"case_id":"臺灣高等法院 115 年度 聲 字第 349 號民事裁定",
                "court":"臺灣高等法院","date":"115-08-28","summary":"訴訟救助",
                "url":"https://judgment.example.invalid/j","jid":"TPHV,115,聲,349,20260828,1"}]}
                """));

        var plan = new ResearchPlan(List.of(), List.of(
                new ResearchPlan.JudgmentKeywordQuery("車禍 損害賠償", "民事", "", "", "", 3)), "");
        var result = new McpTaiwanLegalDbAdapter(client).retrieve(plan);

        assertEquals("臺灣高等法院 115 年度 聲 字第 349 號民事裁定",
                result.keywordCandidates().getFirst().citation());
        assertEquals("TPHV,115,聲,349,20260828,1", result.keywordCandidates().getFirst().rawId());
    }

    /** 建立 MCP 純文字回應，模擬 Spring AI client 的實際結果型別。 */
    private static McpSchema.CallToolResult text(String payload) {
        return new McpSchema.CallToolResult(List.of(new McpSchema.TextContent(payload)), false, null, Map.of());
    }
}
