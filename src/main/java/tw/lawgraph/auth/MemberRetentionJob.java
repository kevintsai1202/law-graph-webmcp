package tw.lawgraph.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 個資保存期限排程：超過保存天數未再登入的會員，先把其使用事件去識別化，再刪除會員資料本身。
 * 每日台北時間 03:30 執行一次（離峰時段）。
 */
public class MemberRetentionJob {
    private static final Logger LOGGER = LoggerFactory.getLogger(MemberRetentionJob.class);

    private final MemberStore members;
    private final UsageEventStore events;
    /** 自最後登入起算的保存天數。 */
    private final int retentionDays;
    /** 可注入固定時鐘以利測試。 */
    private final Clock clock;

    public MemberRetentionJob(MemberStore members, UsageEventStore events, int retentionDays, Clock clock) {
        this.members = members;
        this.events = events;
        this.retentionDays = retentionDays;
        this.clock = clock;
    }

    /** 執行清理，回傳實際刪除的會員數（回傳值供測試與記錄使用）。 */
    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Taipei")
    public int run() {
        Instant cutoff = clock.instant().minus(Duration.ofDays(retentionDays));
        List<String> stale = members.inactiveSubs(cutoff);
        for (String sub : stale) {
            try {
                // 與配額計數同一把雜湊函式；保存期限清理是全量去識別化（含當天）。
                events.anonymize(tw.lawgraph.usage.IdentityHash.of("user:" + sub));
            } catch (RuntimeException e) {
                // 不記 sub（個資），只記雜湊前 8 碼以便對照。
                LOGGER.warn("會員 {} 的事件去識別化失敗：{}",
                        tw.lawgraph.usage.IdentityHash.of("user:" + sub).substring(0, 8), e.getClass().getSimpleName());
            }
        }
        int deleted = stale.isEmpty() ? 0 : members.deleteInactiveBefore(cutoff);
        if (deleted > 0) LOGGER.info("已刪除逾保存期限（{} 天未登入）的會員 {} 位", retentionDays, deleted);
        return deleted;
    }
}
