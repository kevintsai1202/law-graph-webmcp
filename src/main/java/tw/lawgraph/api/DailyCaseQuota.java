package tw.lawgraph.api;

import tw.lawgraph.usage.InMemoryUsageEventStore;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 每人每日案件配額：次數直接由 case_event 事件儲存（正式環境為資料庫）計數，台北日曆日跨日歸零。
 * 本身不再自行累加——扣次數的動作等同於「案件啟動事件被寫入」，由 CaseController 於啟動成功後記錄。
 * 本站免費開放，為了讓更多人用得到，每人每天只給固定次數；上限依身分（匿名／登入）由呼叫端傳入，0 代表不限制。
 */
public final class DailyCaseQuota {
    /** 配額以台北時間的日曆日為單位。 */
    static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    private final Clock clock;
    /** 次數來源：case_event 事件儲存。 */
    private final UsageEventStore store;

    /** 某個身分雜湊今日的配額快照；limit 為 0 時 remaining 回 -1、exhausted 恆為 false。 */
    public record Snapshot(String date, int used, int limit, int remaining, boolean exhausted) {}

    /** 相容舊呼叫端與單元測試：以記憶體事件儲存計數（重啟歸零）。 */
    public DailyCaseQuota(Clock clock) {
        this(clock, new InMemoryUsageEventStore());
    }

    /** 以時鐘與事件儲存建立；上限由呼叫端依身分傳入。 */
    public DailyCaseQuota(Clock clock, UsageEventStore store) {
        this.clock = clock;
        this.store = store;
    }

    /** 檢查是否還有今日配額（不累加，實際計數來自啟動事件）。limit 為 0 時永遠成功。 */
    public boolean tryAcquire(String identityHash, int limit) {
        if (limit <= 0) return true;
        return count(identityHash) < limit;
    }

    /** 取得某個身分雜湊在指定上限下的今日使用狀況。 */
    public Snapshot snapshot(String identityHash, int limit) {
        int used = count(identityHash);
        int remaining = limit > 0 ? Math.max(0, limit - used) : -1;
        return new Snapshot(today().toString(), used, limit, remaining, limit > 0 && used >= limit);
    }

    /** 查今日次數；儲存異常一律轉成 QuotaStoreUnavailableException，讓 API 明確回 503。 */
    private int count(String identityHash) {
        try {
            return store.countToday(identityHash, today());
        } catch (RuntimeException exception) {
            throw new QuotaStoreUnavailableException(exception);
        }
    }

    /** 台北時間的今天。 */
    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZONE);
    }
}
