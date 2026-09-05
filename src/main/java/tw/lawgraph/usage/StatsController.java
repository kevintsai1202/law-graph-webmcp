package tw.lawgraph.usage;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tw.lawgraph.auth.MemberStore;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 統計端點：提供近 N 日每日呼叫次數／模式／身分別／完成失敗數與 token 用量，
 * 以及會員總數與當日活躍數，供內部儀表板使用。唯讀、不涉個資，回應快取 60 秒。
 */
@RestController
public class StatsController {
    private static final Logger log = LoggerFactory.getLogger(StatsController.class);

    /** 每日次數統計來源。 */
    private final UsageEventStore events;
    /** 會員總數／活躍數來源。 */
    private final MemberStore members;
    /** 「今天」的判定時鐘，測試可注入固定時鐘。 */
    private final Clock clock;

    /** 正式環境建構子：以台北時區的系統時鐘判定日期。 */
    @Autowired
    public StatsController(UsageEventStore events, MemberStore members) {
        this(events, members, Clock.system(MemberStore.ZONE));
    }

    /** 測試用建構子：可注入固定時鐘以驗證日期夾住與邊界行為。 */
    StatsController(UsageEventStore events, MemberStore members, Clock clock) {
        this.events = events;
        this.members = members;
        this.clock = clock;
    }

    /** GET /api/stats?days=30：days 夾住在 [1,90]，回傳每日列表、today 摘要與會員概況。 */
    @GetMapping("/api/stats")
    public ResponseEntity<StatsView> stats(@RequestParam(defaultValue = "30") int days) {
        int clampedDays = Math.max(1, Math.min(90, days));
        LocalDate today = LocalDate.now(clock);
        LocalDate from = today.minusDays(clampedDays - 1L);

        List<DayView> dayViews = events.dailyStats(from, today).stream().map(DayView::of).toList();
        DayView todayView = dayViews.isEmpty() ? DayView.zero(today) : dayViews.get(dayViews.size() - 1);

        StatsView view = new StatsView(from.toString(), today.toString(), dayViews, todayView,
                loadMembers(today), events.name());
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS)).body(view);
    }

    /** 會員總數／活躍數查詢失敗不應中斷統計回應，只記警告並回 -1/-1。 */
    private Members loadMembers(LocalDate today) {
        try {
            return new Members(members.count(), members.countActiveOn(today));
        } catch (RuntimeException e) {
            log.warn("MemberStore 查詢失敗，統計回應以 -1/-1 佔位: {}", e.toString());
            return new Members(-1, -1);
        }
    }

    /** 依模式分類的次數。 */
    public record ByMode(@JsonProperty("case") long caseMode, long contract) {}

    /** 依身分別分類的次數。 */
    public record ByIdentity(long anonymous, long member) {}

    /** 單日統計列。 */
    public record DayView(String day, long total, ByMode byMode, ByIdentity byIdentity,
                           long completed, long failed, long promptTokens, long completionTokens, long totalTokens) {
        /** 由 DailyStats 轉換為對前端輸出用的巢狀結構。 */
        static DayView of(DailyStats s) {
            return new DayView(s.day().toString(), s.total(), new ByMode(s.caseMode(), s.contractMode()),
                    new ByIdentity(s.anonymous(), s.member()), s.completed(), s.failed(),
                    s.promptTokens(), s.completionTokens(), s.totalTokens());
        }

        /** 無資料時的零值列（例如查詢區間內沒有任何事件）。 */
        static DayView zero(LocalDate day) {
            return new DayView(day.toString(), 0, new ByMode(0, 0), new ByIdentity(0, 0), 0, 0, 0, 0, 0);
        }
    }

    /** 會員總數與當日活躍數。 */
    public record Members(long total, long activeToday) {}

    /** GET /api/stats 完整回應。 */
    public record StatsView(String from, String to, List<DayView> days, DayView today, Members members, String store) {}
}
