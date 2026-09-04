package tw.lawgraph.api;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 每人每日案件配額：以呼叫端 key（IP）計數，台北日曆日跨日歸零；重啟歸零。
 * 本站免費開放，為了讓更多人用得到，每人每天只給固定次數；上限依身分（匿名／登入）由呼叫端傳入，0 代表不限制。
 */
public final class DailyCaseQuota {
    /** 配額以台北時間的日曆日為單位。 */
    static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    private final Clock clock;
    /** key → 今日日期與已用次數。 */
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();

    /** 某個 key 今日的配額快照；limit 為 0 時 remaining 回 -1、exhausted 恆為 false。 */
    public record Snapshot(String date, int used, int limit, int remaining, boolean exhausted) {}

    /** 以時鐘建立；上限由呼叫端依身分傳入。 */
    public DailyCaseQuota(Clock clock) {
        this.clock = clock;
    }

    /** 嘗試扣一次配額；成功回 true。limit 為 0 時永遠成功。 */
    public synchronized boolean tryAcquire(String key, int limit) {
        LocalDate today = today();
        Counter counter = current(key, today);
        if (limit > 0 && counter.used >= limit) return false;
        counters.put(key, new Counter(today, counter.used + 1));
        return true;
    }

    /** 取得某個 key 在指定上限下的今日使用狀況。 */
    public synchronized Snapshot snapshot(String key, int limit) {
        LocalDate today = today();
        Counter counter = current(key, today);
        int remaining = limit > 0 ? Math.max(0, limit - counter.used) : -1;
        return new Snapshot(today.toString(), counter.used, limit, remaining, limit > 0 && counter.used >= limit);
    }

    /** 取得 key 的今日計數；日期已過就視為 0。 */
    private Counter current(String key, LocalDate today) {
        Counter counter = counters.get(key);
        return counter == null || !counter.date.equals(today) ? new Counter(today, 0) : counter;
    }

    /** 台北時間的今天。 */
    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZONE);
    }

    /** 某天的已用次數。 */
    private record Counter(LocalDate date, int used) {}
}
