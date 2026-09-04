package tw.lawgraph.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 每日 LLM token 預算（input＋output 加總，以台北時區的日曆日計算）。
 * 超過上限或手動暫停時，案件 API 拒絕啟動新案件與提交答案，避免繼續消耗 token。
 * 累計透過 UsageStore 保存：正式環境用資料庫（重佈不歸零），無資料庫時退回檔案。
 */
public class DailyTokenBudget {
    private static final Logger LOGGER = LoggerFactory.getLogger(DailyTokenBudget.class);
    /** 預設時區：台灣。 */
    static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    /** 每日上限（prompt＋completion tokens）；0 或負數代表不限制。 */
    private final long dailyLimit;
    /** 手動暫停旗標（LAWGRAPH_LLM_PAUSED）；為 true 時不論用量一律拒絕。 */
    private final boolean paused;
    private final UsageStore store;
    private final Clock clock;
    private final Object lock = new Object();

    /** 目前累計所屬日期。 */
    private LocalDate date;
    /** 今日 prompt tokens。 */
    private long promptTokens;
    /** 今日 completion tokens。 */
    private long completionTokens;
    /** 每個 agent process 最近一次觀測到的累計用量，用來換算增量。 */
    private final Map<String, long[]> lastSeenByProcess = new ConcurrentHashMap<>();

    /** 以檔案儲存建立預算（path 空白時只存記憶體）；保留給既有呼叫端與測試。 */
    public DailyTokenBudget(long dailyLimit, boolean paused, String path) {
        this(dailyLimit, paused, path == null || path.isBlank() ? UsageStore.inMemory() : new FileUsageStore(path),
                Clock.system(ZONE));
    }

    /** 以指定儲存建立預算並載入今日既有累計。 */
    public DailyTokenBudget(long dailyLimit, boolean paused, UsageStore store, Clock clock) {
        this.dailyLimit = dailyLimit;
        this.paused = paused;
        this.store = store == null ? UsageStore.inMemory() : store;
        this.clock = clock == null ? Clock.system(ZONE) : clock;
        this.date = today();
        load();
    }

    /**
     * 以某個 agent process 的「累計」用量更新今日總量：只把相對上一次觀測的增量加進來，
     * 因為 Embabel 的 AgentProcess 用量是該流程從頭到現在的總和。
     */
    public void observeProcessUsage(String processId, long cumulativePrompt, long cumulativeCompletion) {
        long[] last = lastSeenByProcess.getOrDefault(processId, new long[]{0, 0});
        long deltaPrompt = Math.max(0, cumulativePrompt - last[0]);
        long deltaCompletion = Math.max(0, cumulativeCompletion - last[1]);
        lastSeenByProcess.put(processId, new long[]{cumulativePrompt, cumulativeCompletion});
        if (deltaPrompt == 0 && deltaCompletion == 0) return;
        add(deltaPrompt, deltaCompletion);
    }

    /** 直接累加今日用量（供測試與非 Embabel 路徑使用）。 */
    public void add(long prompt, long completion) {
        synchronized (lock) {
            rolloverIfNeeded();
            promptTokens += Math.max(0, prompt);
            completionTokens += Math.max(0, completion);
            save();
            if (dailyLimit > 0 && usedTokensLocked() >= dailyLimit) {
                LOGGER.warn("每日 token 上限已到：used={} limit={} date={}", usedTokensLocked(), dailyLimit, date);
            }
        }
    }

    /** 今日 input＋output 合計。 */
    public long usedTokens() {
        synchronized (lock) {
            rolloverIfNeeded();
            return usedTokensLocked();
        }
    }

    /** 是否應拒絕新的 LLM 工作：手動暫停，或今日用量已達上限。 */
    public boolean exhausted() {
        if (paused) return true;
        return dailyLimit > 0 && usedTokens() >= dailyLimit;
    }

    /** 對外揭露的非敏感快照。 */
    public Snapshot snapshot() {
        synchronized (lock) {
            rolloverIfNeeded();
            return new Snapshot(date.toString(), promptTokens, completionTokens, usedTokensLocked(), dailyLimit, paused,
                    exhausted(), store.name());
        }
    }

    private long usedTokensLocked() {
        return promptTokens + completionTokens;
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    /** 跨日時歸零並清掉流程觀測紀錄。 */
    private void rolloverIfNeeded() {
        LocalDate now = today();
        if (!now.equals(date)) {
            LOGGER.info("每日 token 預算跨日重置：{} → {}（前一日用量 {}）", date, now, usedTokensLocked());
            date = now;
            promptTokens = 0;
            completionTokens = 0;
            lastSeenByProcess.clear();
            load();
        }
    }

    /** 從儲存載入今日累計；沒有紀錄即從 0 起算。 */
    private void load() {
        try {
            store.load(date).ifPresentOrElse(usage -> {
                promptTokens = usage.promptTokens();
                completionTokens = usage.completionTokens();
            }, () -> {
                promptTokens = 0;
                completionTokens = 0;
            });
        } catch (RuntimeException exception) {
            LOGGER.warn("無法載入今日 token 用量（{}），改以 0 起算。錯誤類型={}", store.name(),
                    exception.getClass().getSimpleName());
        }
    }

    /** 保存今日累計；儲存失敗只記錄，不影響主流程。 */
    private void save() {
        try {
            store.save(new UsageStore.DailyUsage(date, promptTokens, completionTokens));
        } catch (RuntimeException exception) {
            LOGGER.warn("無法保存今日 token 用量（{}）。錯誤類型={}", store.name(), exception.getClass().getSimpleName());
        }
    }

    /** 對外快照：不含任何秘密。 */
    public record Snapshot(String date, long promptTokens, long completionTokens, long usedTokens, long dailyLimit,
                           boolean paused, boolean exhausted, String store) {}
}
