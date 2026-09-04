package tw.lawgraph.api;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 每人每日案件配額：依台北日曆日計數，跨日歸零，0 代表不限制。 */
class DailyCaseQuotaTest {
    /** 2026-09-04 12:00 台北時間。 */
    private static final Instant NOON = Instant.parse("2026-09-04T04:00:00Z");

    /** 三次內成功，第四次拒絕，快照正確反映剩餘次數。 */
    @Test void allowsThreeThenRejects() {
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC));
        assertTrue(quota.tryAcquire("1.1.1.1", 3));
        assertTrue(quota.tryAcquire("1.1.1.1", 3));
        assertTrue(quota.tryAcquire("1.1.1.1", 3));
        assertFalse(quota.tryAcquire("1.1.1.1", 3));
        var snapshot = quota.snapshot("1.1.1.1", 3);
        assertEquals(3, snapshot.used());
        assertEquals(3, snapshot.limit());
        assertEquals(0, snapshot.remaining());
        assertEquals("2026-09-04", snapshot.date());
        assertTrue(snapshot.exhausted());
    }

    /** 不同使用者各自計數。 */
    @Test void countsPerKey() {
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC));
        assertTrue(quota.tryAcquire("a", 1));
        assertTrue(quota.tryAcquire("b", 1));
        assertFalse(quota.tryAcquire("a", 1));
        assertEquals(1, quota.snapshot("b", 1).used());
    }

    /** 台北時間過午夜就歸零（UTC 16:00 = 台北 00:00）。 */
    @Test void resetsAtTaipeiMidnight() {
        var clock = new MutableClock(Instant.parse("2026-09-04T15:59:00Z"));
        var quota = new DailyCaseQuota(clock);
        assertTrue(quota.tryAcquire("a", 1));
        assertFalse(quota.tryAcquire("a", 1));
        clock.now = Instant.parse("2026-09-04T16:01:00Z");
        assertEquals(0, quota.snapshot("a", 1).used());
        assertEquals("2026-09-05", quota.snapshot("a", 1).date());
        assertTrue(quota.tryAcquire("a", 1));
    }

    /** 上限 0 代表不限制，剩餘回 -1 表示無上限。 */
    @Test void zeroMeansUnlimited() {
        var quota = new DailyCaseQuota(Clock.fixed(NOON, ZoneOffset.UTC));
        for (int i = 0; i < 10; i++) assertTrue(quota.tryAcquire("a", 0));
        assertFalse(quota.snapshot("a", 0).exhausted());
        assertEquals(-1, quota.snapshot("a", 0).remaining());
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
