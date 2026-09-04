package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 驗證 MCP client 依 server identity／tool schema 選擇，不依賴 List 順序。 */
class McpClientRegistryTest {

    /** 反轉兩個 client 順序後，legal 與 semantic 仍取得正確 client。 */
    @Test
    void selectsClientsIndependentlyOfListOrder() {
        var keyword = client("mcp-taiwan-legal-db", "search_judgments", "query_regulation");
        var semantic = client("tw-legal-rag", "search_bundle");

        var registry = new McpClientRegistry(List.of(semantic, keyword));

        assertEquals(keyword, registry.find("legal-mcp", "search_judgments").orElseThrow());
        assertEquals(semantic, registry.find("tw-legal-rag", "search_bundle").orElseThrow());
    }

    /** production keyword MCP 使用中文 server identity 時仍可由 legal-mcp 設定選出。 */
    @Test
    void selectsProductionChineseTaiwanLegalDbIdentity() {
        var keyword = client("台灣法律資料庫", "search_judgments", "query_regulation");

        assertEquals(keyword, new McpClientRegistry(List.of(keyword))
                .find("legal-mcp", "search_judgments", "query_regulation").orElseThrow());
    }

    /** 同一 identity 出現兩次時不得猜測使用哪個 client。 */
    @Test
    void marksDuplicateIdentityUnavailable() {
        var first = client("tw-legal-rag", "search_bundle");
        var second = client("tw-legal-rag", "search_bundle");

        assertTrue(new McpClientRegistry(List.of(first, second))
                .find("tw-legal-rag", "search_bundle").isEmpty());
    }

    /** 缺少要求工具時不得以 server 名稱單獨判定可用。 */
    @Test
    void rejectsIdentityWithoutRequiredTool() {
        var client = client("tw-legal-rag", "other_tool");

        assertTrue(new McpClientRegistry(List.of(client))
                .find("tw-legal-rag", "search_bundle").isEmpty());
    }

    /** 建立具有固定 server info 與 tool list 的 MCP mock。 */
    private static McpSyncClient client(String name, String... toolNames) {
        var client = mock(McpSyncClient.class);
        when(client.getServerInfo()).thenReturn(new McpSchema.Implementation(name, "test"));
        var tools = java.util.Arrays.stream(toolNames).map(McpClientRegistryTest::tool).toList();
        when(client.listTools()).thenReturn(new McpSchema.ListToolsResult(tools, null, Map.of()));
        return client;
    }

    /** 建立只關心名稱的 tool mock。 */
    private static McpSchema.Tool tool(String name) {
        var tool = mock(McpSchema.Tool.class);
        when(tool.name()).thenReturn(name);
        return tool;
    }
}
