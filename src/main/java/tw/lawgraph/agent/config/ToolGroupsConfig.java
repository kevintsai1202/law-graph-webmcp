package tw.lawgraph.agent.config;

import com.embabel.agent.core.ToolGroup;
import com.embabel.agent.core.ToolGroupDescription;
import com.embabel.agent.core.ToolGroupPermission;
import com.embabel.agent.tools.mcp.McpToolGroup;
import com.embabel.agent.tools.mcp.ToolCallContextMcpMetaConverter;
import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tw.lawgraph.research.mcp.McpClientRegistry;

import java.util.List;
import java.util.Set;

/** 把 legal-mcp 包成 Embabel ToolGroup，只放行六個法律資料庫工具。 */
@Configuration
public class ToolGroupsConfig {
    /** Embabel Action 參照法律工具群組時使用的穩定名稱。 */
    public static final String LEGAL_DB = "taiwan-legal-db";
    /** 參賽版唯一允許 Agent 呼叫的六個 legal-mcp 工具。 */
    public static final Set<String> ALLOWED_TOOLS = Set.of(
            "search_regulations", "query_regulation", "get_pcode",
            "search_judgments", "get_judgment", "get_citations");

    /** 判斷工具名稱是否位於白名單。 */
    public static boolean allowed(String toolName) {
        return ALLOWED_TOOLS.contains(toolName);
    }

    /** 建立法律資料庫 MCP ToolGroup，並在 callback 層套用白名單。 */
    @Bean
    public ToolGroup legalDbToolGroup(List<McpSyncClient> mcpSyncClients) {
        List<McpSyncClient> legalClients = new McpClientRegistry(mcpSyncClients)
                .find("legal-mcp", ALLOWED_TOOLS.toArray(String[]::new))
                .map(List::of).orElse(List.of());
        return new McpToolGroup(
                ToolGroupDescription.create(
                        "Taiwan statutes (law.moj.gov.tw) and court judgments (judicial.gov.tw) lookup", LEGAL_DB),
                "mcp-taiwan-legal-db",
                LEGAL_DB,
                Set.of(ToolGroupPermission.INTERNET_ACCESS),
                legalClients,
                callback -> allowed(callback.getToolDefinition().name()),
                ToolCallContextMcpMetaConverter.passThrough());
    }
}
