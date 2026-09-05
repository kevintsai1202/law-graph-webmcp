package tw.lawgraph.usage;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 單一案件（case）或合約審閱（contract）呼叫事件的快照。
 * caseId：唯一識別碼；day：發生日（用於每日聚合）；mode："case" 或 "contract"；
 * identityKind："anonymous" 或 "member"；identityHash：身分雜湊（可為 null，匿名化後即為 null）；
 * model：使用的模型名稱；status：RUNNING／COMPLETED／FAILED；
 * promptTokens／completionTokens：累計 token 數；startedAt／finishedAt：起訖時間（finishedAt 未完成時為 null）。
 */
public record CaseEvent(String caseId, LocalDate day, String mode, String identityKind, String identityHash,
                         String model, String status, long promptTokens, long completionTokens,
                         Instant startedAt, Instant finishedAt) {
}
