package tw.lawgraph.api;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 每 IP 每小時 N 次的滑動視窗限流測試。 */
class RateLimiterTest {
    /** 同一 IP 到上限後阻擋，視窗滑動後恢復。 */
    @Test
    void allowsUpToLimitThenBlocksUntilWindowSlides() {
        var clock = new MutableClock(Instant.parse("2026-08-30T00:00:00Z"));
        var limiter = new RateLimiter(2, clock);
        assertTrue(limiter.tryAcquire("1.1.1.1")); assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertFalse(limiter.tryAcquire("1.1.1.1")); assertTrue(limiter.tryAcquire("2.2.2.2"));
        clock.advance(Duration.ofMinutes(61)); assertTrue(limiter.tryAcquire("1.1.1.1"));
    }

    /** 測試用可推進時鐘。 */
    static final class MutableClock extends Clock {
        private Instant now;
        MutableClock(Instant start) { this.now = start; }
        void advance(Duration duration) { now = now.plus(duration); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
