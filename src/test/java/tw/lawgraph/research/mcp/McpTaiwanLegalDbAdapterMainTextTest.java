package tw.lawgraph.research.mcp;

import org.junit.jupiter.api.Test;
import tw.lawgraph.research.ResearchPlan;

import static org.junit.jupiter.api.Assertions.*;

/** 驗證判決關鍵字查詢的 mainText（輸贏方篩選）能正確轉為 MCP main_text 參數。 */
class McpTaiwanLegalDbAdapterMainTextTest {
    @Test void mainTextForwardedWhenPresent() {
        var q = new ResearchPlan.JudgmentKeywordQuery("加班費 放棄", "民事", "", "", "", 5, "被告應給付");
        assertEquals("被告應給付", McpTaiwanLegalDbAdapter.judgmentArguments(q).get("main_text"));
        var legacy = new ResearchPlan.JudgmentKeywordQuery("x", "", "", "", "", null);
        assertFalse(McpTaiwanLegalDbAdapter.judgmentArguments(legacy).containsKey("main_text"));
        assertEquals("", legacy.mainText());
    }
}
