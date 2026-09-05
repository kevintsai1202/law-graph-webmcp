package tw.lawgraph.usage;

import java.time.LocalDate;
import java.util.Optional;

/** 每日 token 累計的儲存介面：檔案（單機備援）或資料庫（跨重佈保留）。 */
public interface UsageStore {

    /** 讀取指定日期的累計；沒有紀錄回 empty。 */
    Optional<DailyUsage> load(LocalDate day);

    /** 以覆寫方式保存指定日期的累計。 */
    void save(DailyUsage usage);

    /** 儲存實作名稱，供 /api/usage 與 log 顯示。 */
    String name();

    /** 單日累計紀錄；llmCalls／cachedTokens／reasoningTokens 為 M3 新增的 LLM 呼叫統計欄位。 */
    record DailyUsage(LocalDate day, long promptTokens, long completionTokens, long llmCalls, long cachedTokens,
                       long reasoningTokens) {
        /** 相容既有呼叫端：不提供 LLM 呼叫統計時三欄一律為 0。 */
        public DailyUsage(LocalDate day, long promptTokens, long completionTokens) {
            this(day, promptTokens, completionTokens, 0, 0, 0);
        }
    }

    /** 不落地的儲存：測試或明確停用持久化時使用。 */
    static UsageStore inMemory() {
        return new UsageStore() {
            private DailyUsage current;
            @Override public Optional<DailyUsage> load(LocalDate day) {
                return current != null && current.day().equals(day) ? Optional.of(current) : Optional.empty();
            }
            @Override public void save(DailyUsage usage) { current = usage; }
            @Override public String name() { return "memory"; }
        };
    }
}
