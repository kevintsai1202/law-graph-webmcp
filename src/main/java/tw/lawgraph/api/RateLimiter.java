package tw.lawgraph.api;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 每個 key 一小時內最多 N 次的滑動視窗限流；重啟歸零。 */
public final class RateLimiter {
    private final int maxPerHour;
    private final Clock clock;
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    /** 建立指定每小時上限與時鐘的限流器。 */
    public RateLimiter(int maxPerHour, Clock clock) {
        this.maxPerHour = maxPerHour;
        this.clock = clock;
    }

    /** 嘗試取得一次配額，成功回 true。 */
    public synchronized boolean tryAcquire(String key) {
        Instant now = clock.instant();
        Deque<Instant> queue = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        while (!queue.isEmpty() && queue.peekFirst().isBefore(now.minus(Duration.ofHours(1)))) {
            queue.pollFirst();
        }
        if (queue.size() >= maxPerHour) return false;
        queue.addLast(now);
        return true;
    }
}
