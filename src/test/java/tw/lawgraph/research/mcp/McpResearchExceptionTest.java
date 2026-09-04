package tw.lawgraph.research.mcp;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 驗證 SDK 包裝例外仍能辨識 OAuth 授權失效。 */
class McpResearchExceptionTest {

    /** 授權錯誤位於 CompletionException／cause 內層時仍須降級為 AUTH。 */
    @Test
    void classifiesAuthorizationSignalFromNestedCause() {
        var nested = new RuntimeException("401 Unauthorized");
        var wrapped = new RuntimeException("MCP request failed", nested);

        assertEquals(McpResearchException.Kind.AUTH,
                McpResearchException.classify("search_bundle", wrapped).kind());
    }

    /** 分類時應保留例外類別鏈（不含訊息），供 WARN log 定位真正來源。 */
    @Test
    void recordsCauseTypesWithoutMessages() {
        var inner = new IllegalStateException("secret payload must not leak");
        var wrapped = new RuntimeException("outer", inner);

        var classified = McpResearchException.classify("search_bundle", wrapped);

        assertEquals("RuntimeException > IllegalStateException", classified.causeTypes());
        assertEquals(false, classified.getMessage().contains("secret"));
    }

    /** SDK 把 McpResearchException 包進其他 RuntimeException 時，應沿用內層已分類的 kind，而非降為 INTERNAL。 */
    @Test
    void reusesNestedMcpResearchExceptionKind() {
        var inner = new McpResearchException(McpResearchException.Kind.AUTH, "OAuth token refresh");
        var wrapped = new RuntimeException("request customizer failed", inner);

        assertEquals(McpResearchException.Kind.AUTH,
                McpResearchException.classify("search_bundle", wrapped).kind());
    }
}
