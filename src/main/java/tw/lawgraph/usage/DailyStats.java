package tw.lawgraph.usage;

import java.time.LocalDate;

/**
 * 某一天的事件聚合統計，無資料的日子以全 0 補齊（見 UsageEventStore.dailyStats）。
 * total：當日總事件數；caseMode／contractMode：依 mode 分類的事件數；
 * anonymous／member：依 identityKind 分類的事件數；completed／failed：依 status 分類的事件數；
 * promptTokens／completionTokens：當日累計 token 數。
 */
public record DailyStats(LocalDate day, long total, long caseMode, long contractMode, long anonymous, long member,
                          long completed, long failed, long promptTokens, long completionTokens) {
    /** 當日 token 總數（prompt + completion）。 */
    public long totalTokens() {
        return promptTokens + completionTokens;
    }
}
