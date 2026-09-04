package tw.lawgraph.research.mcp;

import io.modelcontextprotocol.spec.McpSchema;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/** MCP adapter 共用的安全 payload 讀取工具；不把 SDK 型別帶入 domain。 */
final class McpPayloadSupport {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private McpPayloadSupport() {}

    /** 讀取 structured content 或文字 JSON；MCP error 與空內容一律轉安全例外。 */
    static Object payload(McpSchema.CallToolResult result, String operation) {
        if (result == null || Boolean.TRUE.equals(result.isError())) {
            throw new McpResearchException(McpResearchException.Kind.UPSTREAM, operation);
        }
        if (result.structuredContent() != null) {
            if (!(result.structuredContent() instanceof String structuredText)) return result.structuredContent();
            try {
                return JSON.readValue(structuredText, Object.class);
            } catch (RuntimeException exception) {
                throw McpResearchException.parseFailure(operation);
            }
        }
        String text = result.content().stream()
                .filter(McpSchema.TextContent.class::isInstance)
                .map(McpSchema.TextContent.class::cast)
                .map(McpSchema.TextContent::text)
                .filter(value -> value != null && !value.isBlank())
                .findFirst().orElseThrow(() -> McpResearchException.parseFailure(operation));
        try {
            return JSON.readValue(text, Object.class);
        } catch (RuntimeException exception) {
            throw McpResearchException.parseFailure(operation);
        }
    }

    /** 從 payload 取出候選記錄，支援已確認 fixture 常見的包裝欄位。 */
    static List<Map<String, Object>> records(Object payload, String... collectionKeys) {
        if (payload instanceof Collection<?> collection) {
            return collection.stream().filter(Map.class::isInstance)
                    .map(value -> castMap(value)).toList();
        }
        if (!(payload instanceof Map<?, ?> map)) return List.of();
        for (String key : collectionKeys) {
            Object nested = map.get(key);
            if (nested != null) {
                List<Map<String, Object>> records = records(nested, collectionKeys);
                if (!records.isEmpty()) return records;
            }
        }
        if (looksLikeRecord(map)) return List.of(castMap(map));
        for (Object nested : map.values()) {
            if (nested instanceof Map<?, ?> || nested instanceof Collection<?>) {
                List<Map<String, Object>> records = records(nested, collectionKeys);
                if (!records.isEmpty()) return records;
            }
        }
        return List.of();
    }

    /** 取得 root map 的 allowed_citations，供語意引用白名單使用。 */
    static List<String> allowedCitations(Object payload) {
        if (!(payload instanceof Map<?, ?> map)) return List.of();
        Object value = map.get("allowed_citations");
        if (!(value instanceof Collection<?> collection)) return List.of();
        List<String> allowed = new ArrayList<>();
        for (Object entry : collection) {
            if (entry instanceof Map<?, ?> entryMap) {
                addIfPresent(allowed, entryMap.get("doc_id"));
                addIfPresent(allowed, entryMap.get("citation_id"));
                addIfPresent(allowed, entryMap.get("citation"));
            } else {
                addIfPresent(allowed, entry);
            }
        }
        return allowed.stream().distinct().toList();
    }

    /** 取得多個別名欄位的第一個非空文字值。 */
    static String text(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value).trim();
        }
        return null;
    }

    /** 取得整數欄位，解析失敗時回傳 null。 */
    static Integer integer(Map<String, Object> map, String... keys) {
        String value = text(map, keys);
        if (value == null) return null;
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /** 取得 double 欄位，解析失敗時回傳 null。 */
    static Double decimal(Map<String, Object> map, String... keys) {
        String value = text(map, keys);
        if (value == null) return null;
        try {
            return Double.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /** 取得 boolean 欄位，無法判斷時回傳 false。 */
    static boolean bool(Map<String, Object> map, String... keys) {
        String value = text(map, keys);
        return value != null && Boolean.parseBoolean(value);
    }

    /** 將任意 map 安全轉成字串 object map。 */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    /** 判斷 map 是否本身就是候選記錄，避免把 metadata 當成證據。 */
    private static boolean looksLikeRecord(Map<?, ?> map) {
        return map.containsKey("jid") || map.containsKey("doc_id") || map.containsKey("case_id")
                || map.containsKey("citation") || map.containsKey("law_name")
                || map.containsKey("article_no") || map.containsKey("article_text");
    }

    /** 將非空白白名單值加入清單。 */
    private static void addIfPresent(List<String> values, Object value) {
        if (value != null && !String.valueOf(value).isBlank()) values.add(String.valueOf(value).trim());
    }
}
