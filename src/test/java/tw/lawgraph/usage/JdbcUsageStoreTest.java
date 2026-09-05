package tw.lawgraph.usage;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** JdbcUsageStore 以 H2（PostgreSQL 相容模式）驗證建表、UPSERT 與跨「重啟」續算。 */
class JdbcUsageStoreTest {

    /** 每個測試用獨立的記憶體資料庫。 */
    private static DriverManagerDataSource h2(String name) {
        return new DriverManagerDataSource("jdbc:h2:mem:" + name + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
    }

    /** 同一天多次保存只留一列，且新建的 store（模擬重佈）能讀回。 */
    @Test
    void savesAndReloadsAcrossInstances() {
        var dataSource = h2("usage_reload");
        var store = new JdbcUsageStore(dataSource);
        var day = LocalDate.of(2026, 9, 4);

        store.save(new UsageStore.DailyUsage(day, 100, 20));
        store.save(new UsageStore.DailyUsage(day, 1500, 300));

        var reopened = new JdbcUsageStore(dataSource);
        var loaded = reopened.load(day).orElseThrow();
        assertEquals(1500, loaded.promptTokens());
        assertEquals(300, loaded.completionTokens());
        assertTrue(reopened.load(day.plusDays(1)).isEmpty());
        assertEquals("jdbc", reopened.name());
    }

    /** DailyTokenBudget 搭配資料庫儲存：重建預算物件（模擬重佈）後今日用量不歸零，跨日則從 0 起算。 */
    @Test
    void budgetSurvivesRedeployWithJdbcStore() {
        var dataSource = h2("usage_budget");
        var taipei = ZoneId.of("Asia/Taipei");
        var sept4 = Clock.fixed(Instant.parse("2026-09-04T02:00:00Z"), taipei);
        var budget = new DailyTokenBudget(2_000_000, false, new JdbcUsageStore(dataSource), sept4);
        budget.add(700_000, 300_000);

        var redeployed = new DailyTokenBudget(2_000_000, false, new JdbcUsageStore(dataSource), sept4);
        assertEquals(1_000_000, redeployed.usedTokens());
        assertEquals("jdbc", redeployed.snapshot().store());

        var sept5 = Clock.fixed(Instant.parse("2026-09-05T02:00:00Z"), taipei);
        var nextDay = new DailyTokenBudget(2_000_000, false, new JdbcUsageStore(dataSource), sept5);
        assertEquals(0, nextDay.usedTokens());
        assertEquals(1_000_000, new JdbcUsageStore(dataSource).load(LocalDate.of(2026, 9, 4)).orElseThrow().promptTokens()
                + new JdbcUsageStore(dataSource).load(LocalDate.of(2026, 9, 4)).orElseThrow().completionTokens(),
                "前一日歷史紀錄應保留");
    }

    /** 舊表（M3 之前建立，沒有 llm_calls／cached_tokens／reasoning_tokens 欄位）也要能自動補欄並落地新統計。 */
    @Test
    void persistsLlmCallColumnsAndMigratesOldTable() {
        var dataSource = h2("usage_llm");
        new org.springframework.jdbc.core.JdbcTemplate(dataSource).execute(
                "CREATE TABLE usage_daily (usage_day VARCHAR(10) PRIMARY KEY, prompt_tokens BIGINT NOT NULL, "
                        + "completion_tokens BIGINT NOT NULL, updated_at TIMESTAMP NOT NULL)");
        var store = new JdbcUsageStore(dataSource); // 舊表存在也要能 ALTER 補欄
        var day = LocalDate.of(2026, 9, 5);

        store.save(new UsageStore.DailyUsage(day, 10, 5, 3, 4, 2));
        var loaded = store.load(day).orElseThrow();

        assertEquals(3, loaded.llmCalls());
        assertEquals(4, loaded.cachedTokens());
        assertEquals(2, loaded.reasoningTokens());
    }
}
