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
                Map.of("law_name", "民法", "article_no", "184")))).thenReturn(text("""
                {"law_name":"民法","article_no":"184","article_text":"條文原文"}
                """));

        var plan = new ResearchPlan(List.of("民法第184條第1項"), List.of(
                new ResearchPlan.JudgmentKeywordQuery("車禍 損害賠償", "民事", "最高法院", "", "", 10)), "案情");
        var result = new McpTaiwanLegalDbAdapter(client).retrieve(plan);

        assertEquals(1, result.laws().size());
        // 「第1項」是項不是條之1：條號只送 184，扁平舊格式沒有查詢原文可對照，ref 以法規名＋條號組成
        assertEquals("民法第184條", result.laws().getFirst().ref());
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

    /** production legal-mcp 的 query_regulation 實際回傳 law／articles／source_url，且只到條層級；ref 應保留查詢的項款。 */
    @Test
    void parsesProductionRegulationPayload() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("{\"judgments\":[]}"));
        when(client.callTool(new McpSchema.CallToolRequest("query_regulation",
                Map.of("law_name", "民法", "article_no", "184")))).thenReturn(text("""
                {"success":true,"cached":false,"law":{"pcode":"B0000001","name":"民法","status":"現行法規"},
                 "articles":[{"number":"184","content":"因故意或過失，不法侵害他人之權利者，負損害賠償責任。"}],
                 "source_url":"https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=184"}
                """));
        when(client.callTool(new McpSchema.CallToolRequest("query_regulation",
                Map.of("law_name", "土地法", "article_no", "34-1")))).thenReturn(text("""
                {"success":true,"law":{"pcode":"D0060001","name":"土地法","status":"現行法規"},
                 "articles":[{"number":"34-1","content":"共有土地或建築改良物，其處分、變更……"}],
                 "source_url":"https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0060001&flno=34-1"}
                """));

        var plan = new ResearchPlan(List.of("民法第184條第1項", "土地法第34條之1第2項"), List.of(), "案情");
        var result = new McpTaiwanLegalDbAdapter(client).retrieve(plan);

        assertEquals(2, result.laws().size());
        var civil = result.laws().get(0);
        assertEquals("民法第184條第1項", civil.ref(), "ref 應保留查詢原文的項，供 GraphRules 與 LLM 節點 ref 對得上");
        assertEquals("民法", civil.title());
        assertTrue(civil.articleText().startsWith("因故意或過失"));
        assertEquals("https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=184", civil.source());
        assertEquals("土地法第34條之1第2項", result.laws().get(1).ref());
    }

    /** 只給法規名、沒有條號的查詢會把整部法規（民法 1225 條）灌進研究結果，必須跳過且不呼叫 MCP。 */
    @Test
    void skipsWholeLawQueriesWithoutArticleNumber() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("{\"judgments\":[]}"));

        var result = new McpTaiwanLegalDbAdapter(client).retrieve(new ResearchPlan(List.of("民法", "洗錢防制法"), List.of(), "案情"));

        assertEquals(0, result.laws().size());
        verify(client, org.mockito.Mockito.never()).callTool(org.mockito.ArgumentMatchers.argThat(
                request -> request != null && "query_regulation".equals(request.name())));
    }

    /** 即使每條查詢都合法，法條總數也要有上限，避免研究結果撐爆後續 LLM 上下文。 */
    @Test
    void capsTotalLawCount() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenAnswer(invocation -> {
            McpSchema.CallToolRequest request = invocation.getArgument(0);
            if (!"query_regulation".equals(request.name())) return text("{\"judgments\":[]}");
            String no = String.valueOf(request.arguments().get("article_no"));
            return text("{\"law\":{\"name\":\"民法\"},\"articles\":[{\"number\":\"" + no + "\",\"content\":\"x\"}]}");
        });
        List<String> queries = new java.util.ArrayList<>();
        for (int i = 1; i <= McpTaiwanLegalDbAdapter.MAX_LAWS + 10; i++) queries.add("民法第" + i + "條");

        var result = new McpTaiwanLegalDbAdapter(client).retrieve(new ResearchPlan(queries, List.of(), "案情"));

        assertEquals(McpTaiwanLegalDbAdapter.MAX_LAWS, result.laws().size());
    }

    /** query_regulation 查無條文（articles 為空）時不得產生假法條。 */
    @Test
    void skipsRegulationWithoutArticles() {
        McpSyncClient client = mock(McpSyncClient.class);
        when(client.callTool(any())).thenReturn(text("{\"judgments\":[]}"));
        when(client.callTool(new McpSchema.CallToolRequest("query_regulation",
                Map.of("law_name", "不存在法", "article_no", "1")))).thenReturn(text("""
                {"success":false,"law":null,"articles":[],"error":"law not found"}
                """));

        var result = new McpTaiwanLegalDbAdapter(client).retrieve(new ResearchPlan(List.of("不存在法第1條"), List.of(), "案情"));

        assertEquals(0, result.laws().size());
    }

    /** 建立 MCP 純文字回應，模擬 Spring AI client 的實際結果型別。 */
    private static McpSchema.CallToolResult text(String payload) {
        return new McpSchema.CallToolResult(List.of(new McpSchema.TextContent(payload)), false, null, Map.of());
    }
}
