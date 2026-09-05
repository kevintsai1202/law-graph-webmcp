package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import tw.lawgraph.usage.CaseEvent;
import tw.lawgraph.usage.InMemoryUsageEventStore;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 每人每日案件配額：改由 case_event 事件儲存計數（台北日曆日），0 代表不限制，儲存異常需明確失敗。 */
class DailyCaseQuotaTest {
    /** 2026-09-04 12:00 台北時間。 */
    private static final Instant NOON = Instant.parse("2026-09-04T04:00:00Z");

    /** 在事件儲存塞入指定身分雜湊在該日的 n 筆啟動事件。 */
    private static void seed(UsageEventStore store, String hash, LocalDate day, int n) {
        for (int i = 0; i < n; i++) {
            store.recordStart(new CaseEvent(hash + "-" + day + "-" + i, day, "case", "anonymous", hash,
                    "default", "RUNNING", 0, 0, Instant.parse("2026-09-04T04:00:00Z"), null));
        }
    }

    /** 已用 3 次且上限 3 時拒絕；快照顯示 3/3 已用盡。 */
    @Test void rejectsWhenStoredCountReachesLimit() {
        var store = new InMemoryUsageEventStore();
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC), store);
        seed(store, "h1", LocalDate.of(2026, 9, 4), 2);
        assertTrue(quota.tryAcquire("h1", 3));
        // 第 3 筆事件寫入後即用盡（caseId 需相異，事件儲存以 caseId 為主鍵）
        store.recordStart(new CaseEvent("h1-third", LocalDate.of(2026, 9, 4), "case", "anonymous", "h1",
                "default", "RUNNING", 0, 0, NOON, null));
        assertFalse(quota.tryAcquire("h1", 3));
        var snapshot = quota.snapshot("h1", 3);
        assertEquals(3, snapshot.used());
        assertEquals(3, snapshot.limit());
        assertEquals(0, snapshot.remaining());
        assertEquals("2026-09-04", snapshot.date());
        assertTrue(snapshot.exhausted());
    }

    /** 不同身分雜湊各自計數。 */
    @Test void countsPerIdentityHash() {
        var store = new InMemoryUsageEventStore();
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC), store);
        seed(store, "a", LocalDate.of(2026, 9, 4), 1);
        assertFalse(quota.tryAcquire("a", 1));
        assertTrue(quota.tryAcquire("b", 1));
        assertEquals(0, quota.snapshot("b", 1).used());
    }

    /** 台北時間過午夜就換算到新的一天（UTC 16:00 = 台北 00:00）。 */
    @Test void resetsAtTaipeiMidnight() {
        var store = new InMemoryUsageEventStore();
        var clock = new MutableClock(Instant.parse("2026-09-04T15:59:00Z"));
        var quota = new DailyCaseQuota(clock, store);
        seed(store, "a", LocalDate.of(2026, 9, 4), 1);
        assertFalse(quota.tryAcquire("a", 1));
        clock.now = Instant.parse("2026-09-04T16:01:00Z");
        assertEquals(0, quota.snapshot("a", 1).used());
        assertEquals("2026-09-05", quota.snapshot("a", 1).date());
        assertTrue(quota.tryAcquire("a", 1));
    }

    /** 上限 0 代表不限制，剩餘回 -1 表示無上限。 */
    @Test void zeroMeansUnlimited() {
        var store = new InMemoryUsageEventStore();
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC), store);
        seed(store, "a", LocalDate.of(2026, 9, 4), 10);
        assertTrue(quota.tryAcquire("a", 0));
        assertFalse(quota.snapshot("a", 0).exhausted());
        assertEquals(-1, quota.snapshot("a", 0).remaining());
    }

    /** 單一參數建構子（相容舊呼叫端）預設用記憶體儲存。 */
    @Test void clockOnlyConstructorUsesInMemoryStore() {
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC));
        assertTrue(quota.tryAcquire("a", 1));
        assertEquals(0, quota.snapshot("a", 1).used());
    }

    /** 事件儲存壞掉時明確失敗（不得靜默放行）。 */
    @Test void storeFailureRaisesQuotaStoreUnavailable() {
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC), new BrokenStore());
        assertThrows(QuotaStoreUnavailableException.class, () -> quota.tryAcquire("a", 1));
        assertThrows(QuotaStoreUnavailableException.class, () -> quota.snapshot("a", 1));
    }

    /** 每個查詢都丟例外的假儲存。 */
    private static final class BrokenStore implements UsageEventStore {
        @Override public void recordStart(CaseEvent event) { throw new IllegalStateException("db down"); }
        @Override public void recordTokens(String caseId, long p, long c) { throw new IllegalStateException("db down"); }
        @Override public void recordFinish(String caseId, String status, Instant finishedAt) { throw new IllegalStateException("db down"); }
        @Override public int countToday(String identityHash, LocalDate day) { throw new IllegalStateException("db down"); }
        @Override public List<tw.lawgraph.usage.DailyStats> dailyStats(LocalDate from, LocalDate to) { throw new IllegalStateException("db down"); }
        @Override public void anonymizeBefore(String identityHash, java.time.LocalDate day) { throw new IllegalStateException("db down"); }
        @Override public String name() { return "broken"; }
    }

    /** 可調時間的測試時鐘。 */
    private static final class MutableClock extends Clock {
        Instant now;
        MutableClock(Instant now) { this.now = now; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
