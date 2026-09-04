package tw.lawgraph.api;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.stereotype.Service;
import tw.lawgraph.research.mcp.McpClientRegistry;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 條號與字號存在性驗證：解析後呼叫 taiwan-legal-db 對應工具。 */
@Service
public class CitationVerifier {
    /** 引用種類。 */
    public enum Kind { LAW, JUDGMENT, UNKNOWN }
    /** 解析後的 MCP 查詢目標。 */
    public record Target(Kind kind, String lawName, String articleNo, String judgmentKeyword) {}
    /** WebMCP 與 REST 共用的驗證結果。 */
    public record Verification(String ref, boolean exists, String source, String snippet) {}

    private static final Pattern LAW = Pattern.compile("([\\u4e00-\\u9fff]{2,20}?)第(\\d+(?:-\\d+)?)條");
    private static final Pattern JUDGMENT = Pattern.compile("([\\u4e00-\\u9fff]+法院)(\\d+)年度([\\u4e00-\\u9fff]+)字第(\\d+)號");
    private final McpSyncClient client;

    /** 注入 Spring AI clients，依 identity 選出 legal-mcp，避免依賴清單順序。 */
    public CitationVerifier(List<McpSyncClient> clients) {
        this.client = new McpClientRegistry(clients).find("legal-mcp", "query_regulation", "search_judgments")
                .orElse(null);
    }

    /** 純解析：先找裁判字號，再找法條。 */
    public static Target parse(String ref) {
        if (ref == null) return new Target(Kind.UNKNOWN, null, null, null);
        Matcher judgment = JUDGMENT.matcher(ref);
        if (judgment.find()) return new Target(Kind.JUDGMENT, null, null,
                judgment.group(1) + " " + judgment.group(2) + " " + judgment.group(3) + " " + judgment.group(4));
        Matcher law = LAW.matcher(ref);
        if (law.find()) return new Target(Kind.LAW, law.group(1), law.group(2), null);
        return new Target(Kind.UNKNOWN, null, null, null);
    }

    /** 呼叫 MCP 工具驗證；例外轉為 exists=false。 */
    public Verification verify(String ref) {
        Target target = parse(ref);
        if (target.kind() == Kind.UNKNOWN || client == null) {
            return new Verification(ref, false, null, "unrecognised reference");
        }
        try {
            McpSchema.CallToolResult result = switch (target.kind()) {
                case LAW -> client.callTool(new McpSchema.CallToolRequest("query_regulation",
                        Map.of("law_name", target.lawName(), "article_no", target.articleNo())));
                case JUDGMENT -> client.callTool(new McpSchema.CallToolRequest("search_judgments",
                        Map.of("keyword", target.judgmentKeyword())));
                default -> throw new IllegalStateException();
            };
            String text = result.content().stream().filter(McpSchema.TextContent.class::isInstance)
                    .map(McpSchema.TextContent.class::cast).map(McpSchema.TextContent::text).findFirst().orElse("");
            boolean exists = !Boolean.TRUE.equals(result.isError()) && !text.isBlank() && !text.contains("\"error\"");
            String source = target.kind() == Kind.LAW ? "law.moj.gov.tw" : "judgment.judicial.gov.tw";
            return new Verification(ref, exists, source, text.length() > 300 ? text.substring(0, 300) : text);
        } catch (RuntimeException exception) {
            return new Verification(ref, false, null, "lookup failed: " + exception.getMessage());
        }
    }
}
