package tw.lawgraph.usage;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * case_event 事件儲存介面：記錄每次案件／合約審閱呼叫的開始、token 累加與結束狀態，
 * 並提供依身分雜湊的當日次數查詢、每日聚合統計與匿名化操作。實作見 JdbcUsageEventStore（正式環境）與
 * InMemoryUsageEventStore（測試／無資料庫環境）。
 */
public interface UsageEventStore {
    /** 記錄一次呼叫的起始；同一 caseId 重複呼叫需具備冪等性（不得產生重複列）。 */
    void recordStart(CaseEvent event);

    /** 對指定 caseId 累加 token 用量；caseId 不存在時靜默略過（no-op）。 */
    void recordTokens(String caseId, long deltaPrompt, long deltaCompletion);

    /** 記錄呼叫結束狀態與結束時間。 */
    void recordFinish(String caseId, String status, Instant finishedAt);

    /** 查詢指定身分雜湊在指定日期的呼叫次數（用於每日次數上限判斷）。 */
    int countToday(String identityHash, LocalDate day);

    /** 依日期區間（含起訖）回傳每日聚合統計，無資料的日子補 0，依日期升冪排序。 */
    List<DailyStats> dailyStats(LocalDate from, LocalDate to);

    /**
     * 將指定身分雜湊、且 usage_day 早於 day 的事件之 identity_hash 欄位清空（GDPR／個資去識別化）。
     * 保留 day 當天（含）之後的列是刻意的：否則同一人「刪帳號→重新登入」即可把當天配額歸零。
     */
    void anonymizeBefore(String identityHash, LocalDate day);

    /** 將指定身分雜湊的所有事件去識別化（保存期限清理用，連當天一起清）。 */
    default void anonymize(String identityHash) {
        anonymizeBefore(identityHash, LocalDate.MAX);
    }

    /** 實作名稱（例如 "jdbc"、"memory"），供設定／記錄之用。 */
    String name();
}
