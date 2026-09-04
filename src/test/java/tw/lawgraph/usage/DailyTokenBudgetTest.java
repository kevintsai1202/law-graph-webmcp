package tw.lawgraph.usage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 每日 token 預算：增量換算、上限、暫停、跨日重置與檔案續存。 */
class DailyTokenBudgetTest {
    @TempDir Path tempDir;
    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");

    /** 固定在台北時間 2026-09-04 10:00 的時鐘。 */
    private static Clock at(String isoTaipei) {
        return Clock.fixed(Instant.parse(isoTaipei), TAIPEI);
    }

    /** AgentProcess 回報的是累計值，只能把增量加進今日總量；不同流程各自計算。 */
    @Test
    void accumulatesDeltaPerProcess() {
        var budget = new DailyTokenBudget(2_000_000, false, UsageStore.inMemory(), at("2026-09-04T02:00:00Z"));

        budget.observeProcessUsage("p1", 1000, 200);
        budget.observeProcessUsage("p1", 1500, 300);
        budget.observeProcessUsage("p2", 400, 100);

        assertEquals(1500 + 300 + 400 + 100, budget.usedTokens());
        assertFalse(budget.exhausted());
    }

    /** 達到上限即視為用盡；上限為 0 代表不限制。 */
    @Test
    void exhaustsAtLimit() {
        var budget = new DailyTokenBudget(1000, false, UsageStore.inMemory(), at("2026-09-04T02:00:00Z"));
        budget.add(600, 399);
        assertFalse(budget.exhausted());
        budget.add(1, 0);
        assertTrue(budget.exhausted());

        var unlimited = new DailyTokenBudget(0, false, UsageStore.inMemory(), at("2026-09-04T02:00:00Z"));
        unlimited.add(5_000_000, 5_000_000);
        assertFalse(unlimited.exhausted());
    }

    /** 手動暫停時不論用量一律停用。 */
    @Test
    void pausedAlwaysExhausted() {
        var budget = new DailyTokenBudget(2_000_000, true, UsageStore.inMemory(), at("2026-09-04T02:00:00Z"));
        assertTrue(budget.exhausted());
        assertTrue(budget.snapshot().paused());
    }

    /** 跨過台北時區的日界線後歸零（UTC 15:59 仍是 9/4，16:00 已是 9/5）。 */
    @Test
    void resetsAtTaipeiMidnight() {
        var clock = new MutableClock(Instant.parse("2026-09-04T15:59:00Z"));
        var budget = new DailyTokenBudget(1000, false, UsageStore.inMemory(), clock);
        budget.add(900, 100);
        assertTrue(budget.exhausted());

        clock.now = Instant.parse("2026-09-04T16:00:00Z");
        assertEquals(0, budget.usedTokens());
        assertFalse(budget.exhausted());
        assertEquals("2026-09-05", budget.snapshot().date());
    }

    /** 同一天重啟時從檔案續算；日期不同的舊檔則忽略。 */
    @Test
    void persistsAndReloadsSameDay() throws Exception {
        Path file = tempDir.resolve("usage.json");
        var first = new DailyTokenBudget(2_000_000, false, new FileUsageStore(file.toString()), at("2026-09-04T02:00:00Z"));
        first.add(700, 300);
        assertTrue(Files.isRegularFile(file));

        var sameDay = new DailyTokenBudget(2_000_000, false, new FileUsageStore(file.toString()), at("2026-09-04T05:00:00Z"));
        assertEquals(1000, sameDay.usedTokens());

        var nextDay = new DailyTokenBudget(2_000_000, false, new FileUsageStore(file.toString()), at("2026-09-05T02:00:00Z"));
        assertEquals(0, nextDay.usedTokens());
    }

    /** 可調整時間的測試時鐘。 */
    private static final class MutableClock extends Clock {
        Instant now;
        MutableClock(Instant now) { this.now = now; }
        @Override public ZoneId getZone() { return TAIPEI; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
