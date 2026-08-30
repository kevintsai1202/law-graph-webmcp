package tw.lawgraph.agent.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 只暴露六個法律資料庫工具；憲法法庭工具刻意不開。 */
class ToolGroupsConfigTest {

    /** 驗證工具群組名稱與六項白名單。 */
    @Test
    void whitelistHasSixToolsAndExcludesInterpretations() {
        assertEquals(6, ToolGroupsConfig.ALLOWED_TOOLS.size());
        assertTrue(ToolGroupsConfig.allowed("search_judgments"));
        assertTrue(ToolGroupsConfig.allowed("get_citations"));
        assertFalse(ToolGroupsConfig.allowed("search_interpretations"));
        assertFalse(ToolGroupsConfig.allowed("get_interpretation"));
        assertEquals("taiwan-legal-db", ToolGroupsConfig.LEGAL_DB);
    }
}
