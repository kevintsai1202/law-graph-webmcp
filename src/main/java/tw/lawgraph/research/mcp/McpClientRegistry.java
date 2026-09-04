package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/** 依 MCP server identity 與工具白名單選 client，避免依賴 Spring 注入順序。 */
public final class McpClientRegistry {
    private final List<McpSyncClient> clients;

    /** 保存 Spring AI 提供的 client snapshot；null 以空集合處理。 */
    public McpClientRegistry(List<McpSyncClient> clients) {
        this.clients = clients == null ? List.of() : List.copyOf(clients);
    }

    /** 找出唯一符合設定名稱與必要工具的 client，身份不明或重複時回 empty。 */
    public Optional<McpSyncClient> find(String configuredName, String... requiredTools) {
        Set<String> required = Set.of(requiredTools == null ? new String[0] : requiredTools);
        List<McpSyncClient> matches = clients.stream().filter(client -> matches(client, configuredName, required)).toList();
        return matches.size() == 1 ? Optional.of(matches.getFirst()) : Optional.empty();
    }

    /** 驗證單一 client 的 server info 與完整工具集合。 */
    private static boolean matches(McpSyncClient client, String configuredName, Set<String> requiredTools) {
        if (client == null || configuredName == null || configuredName.isBlank()) return false;
        try {
            McpSchema.Implementation server = client.getServerInfo();
            if (server == null || !identityMatches(server.name(), configuredName)) return false;
            if (requiredTools.isEmpty()) return true;
            var listed = client.listTools();
            return listed != null && listed.tools() != null
                    && listed.tools().stream().filter(java.util.Objects::nonNull)
                    .map(McpSchema.Tool::name).collect(java.util.stream.Collectors.toSet()).containsAll(requiredTools);
        } catch (RuntimeException ignored) {
            // registry 只回報 unavailable，由 orchestration 決定安全降級。
            return false;
        }
    }

    /** 支援 Spring named connection 與遠端 server 常見名稱，但不以清單位置猜測。 */
    private static boolean identityMatches(String serverName, String configuredName) {
        if (serverName == null) return false;
        String displayName = normalizeDisplayName(serverName);
        String actual = compact(serverName);
        String configured = compact(configuredName);
        if (actual.equals(configured)) return true;
        if (isTaiwanLegalDbDisplayName(displayName)
                && (configured.equals("legalmcp") || configured.equals("taiwanlegaldb"))) return true;
        return switch (configured) {
            case "legalmcp", "taiwanlegaldb" -> actual.contains("taiwanlegaldb")
                    || actual.contains("legaldb") || actual.contains("legalmcp");
            case "twlegalrag", "drlawbot" -> actual.contains("twlegalrag")
                    || actual.contains("drlawbot") || actual.contains("drlegal");
            default -> false;
        };
    }

    /** 移除顯示名稱中的空白，保留中文 server identity 供精確別名比對。 */
    private static String normalizeDisplayName(String value) {
        return value.replaceAll("\\s+", "");
    }

    /** 判斷 keyword MCP 的正式繁／簡體顯示名稱。 */
    private static boolean isTaiwanLegalDbDisplayName(String displayName) {
        return displayName.contains("台灣法律資料庫") || displayName.contains("臺灣法律資料庫");
    }

    /** 去除 server identity 的大小寫與非英數字，供安全比較。 */
    private static String compact(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
}
