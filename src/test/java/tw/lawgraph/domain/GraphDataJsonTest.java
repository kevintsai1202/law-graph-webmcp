package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** GraphData 需與 law-powers data.js 的 superset 格式相容：edges 用 from/to，空欄位不輸出。 */
class GraphDataJsonTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    /** 驗證 edge 欄位名稱與 null 欄位省略規則。 */
    @Test
    void serializesEdgesWithFromToAndOmitsNulls() {
        var graph = new GraphData(
                List.of(new GraphNode("f1", "fact", "Accident", null, null, null, null,
                        null, null, null, null, null, null, null)),
                List.of(new GraphEdge("f1", "l1", "適用", null, null)));
        String json = mapper.writeValueAsString(graph);
        assertTrue(json.contains("\"from\":\"f1\""));
        assertTrue(json.contains("\"to\":\"l1\""));
        assertFalse(json.contains("\"description\""), "null 欄位不得輸出，否則渲染器會顯示 null");
    }

    /** 驗證白名單完整包含十九種標籤。 */
    @Test
    void edgeLabelWhitelistContainsAllNineteenLabels() {
        assertEquals(19, EdgeLabel.values().length);
        assertTrue(EdgeLabel.isValid("適用"));
        assertTrue(EdgeLabel.isValid("刑事附帶民事 (民附)"));
        assertFalse(EdgeLabel.isValid("applies to"));
    }

    /** 驗證語系代碼解析與英文預設值。 */
    @Test
    void localeParsesCodesAndDefaultsToEnglish() {
        assertEquals(Locale.ZH_TW, Locale.fromCode("zh-TW"));
        assertEquals(Locale.EN, Locale.fromCode(null));
        assertEquals(Locale.EN, Locale.fromCode("fr"));
    }
}
