package tw.lawgraph.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 以關聯式資料庫保存 case_event 事件（正式環境為 Zeabur PostgreSQL，測試以 H2 執行）。
 * 每個 caseId 對應一列，recordStart 先 UPDATE 再 INSERT 以確保冪等；dailyStats 以單次 GROUP BY
 * 查詢取得有資料的日期，再於 Java 端補齊區間內無資料的日子（全 0）。
 */
public final class JdbcUsageEventStore implements UsageEventStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcUsageEventStore.class);
    private final JdbcTemplate jdbc;

    /** 建立時即確保 case_event 資料表與索引存在。 */
    public JdbcUsageEventStore(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS case_event (
                  case_id VARCHAR(64) PRIMARY KEY,
                  usage_day VARCHAR(10) NOT NULL,
                  mode VARCHAR(16) NOT NULL,
                  identity_kind VARCHAR(16) NOT NULL,
                  identity_hash VARCHAR(64),
                  model VARCHAR(64),
                  status VARCHAR(16) NOT NULL,
                  prompt_tokens BIGINT NOT NULL DEFAULT 0,
                  completion_tokens BIGINT NOT NULL DEFAULT 0,
                  started_at TIMESTAMP NOT NULL,
                  finished_at TIMESTAMP NULL
                )""");
        jdbc.execute("CREATE INDEX IF NOT EXISTS case_event_day ON case_event(usage_day)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS case_event_identity ON case_event(identity_hash, usage_day)");
        LOGGER.info("case_event 資料表就緒（JdbcUsageEventStore）");
    }

    /** 先嘗試 UPDATE（代表已存在，忽略重複的起始記錄以維持冪等），無列更新才 INSERT 新事件。 */
    @Override
    public void recordStart(CaseEvent event) {
        int updated = jdbc.update(
                "UPDATE case_event SET usage_day = ?, mode = ?, identity_kind = ?, identity_hash = ?, model = ?, "
                        + "status = ?, prompt_tokens = ?, completion_tokens = ?, started_at = ?, finished_at = ? "
                        + "WHERE case_id = ?",
                event.day().toString(), event.mode(), event.identityKind(), event.identityHash(), event.model(),
                event.status(), event.promptTokens(), event.completionTokens(), Timestamp.from(event.startedAt()),
                event.finishedAt() == null ? null : Timestamp.from(event.finishedAt()), event.caseId());
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO case_event (case_id, usage_day, mode, identity_kind, identity_hash, model, status, "
                            + "prompt_tokens, completion_tokens, started_at, finished_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    event.caseId(), event.day().toString(), event.mode(), event.identityKind(), event.identityHash(),
                    event.model(), event.status(), event.promptTokens(), event.completionTokens(),
                    Timestamp.from(event.startedAt()), event.finishedAt() == null ? null : Timestamp.from(event.finishedAt()));
        }
    }

    /** 對已存在的 caseId 累加 token 用量；不存在時 UPDATE 影響 0 列，靜默略過。 */
    @Override
    public void recordTokens(String caseId, long deltaPrompt, long deltaCompletion) {
        jdbc.update(
                "UPDATE case_event SET prompt_tokens = prompt_tokens + ?, completion_tokens = completion_tokens + ? "
                        + "WHERE case_id = ?",
                deltaPrompt, deltaCompletion, caseId);
    }

    @Override
    public void recordFinish(String caseId, String status, Instant finishedAt) {
        jdbc.update("UPDATE case_event SET status = ?, finished_at = ? WHERE case_id = ?",
                status, Timestamp.from(finishedAt), caseId);
    }

    @Override
    public int countToday(String identityHash, LocalDate day) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM case_event WHERE identity_hash = ? AND usage_day = ?",
                Integer.class, identityHash, day.toString());
        return count == null ? 0 : count;
    }

    /** 單次 GROUP BY 查出有資料的日期聚合，再逐日補 0 並依日期升冪排序回傳。 */
    @Override
    public List<DailyStats> dailyStats(LocalDate from, LocalDate to) {
        Map<String, Object[]> byDay = new HashMap<>();
        jdbc.query(
                "SELECT usage_day, COUNT(*) AS total, "
                        + "SUM(CASE WHEN mode = 'case' THEN 1 ELSE 0 END) AS case_mode, "
                        + "SUM(CASE WHEN mode = 'contract' THEN 1 ELSE 0 END) AS contract_mode, "
                        + "SUM(CASE WHEN identity_kind = 'anonymous' THEN 1 ELSE 0 END) AS anonymous, "
                        + "SUM(CASE WHEN identity_kind = 'member' THEN 1 ELSE 0 END) AS member, "
                        + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed, "
                        + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed, "
                        + "SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens "
                        + "FROM case_event WHERE usage_day >= ? AND usage_day <= ? GROUP BY usage_day",
                rs -> {
                    byDay.put(rs.getString("usage_day"), new Object[]{
                            rs.getLong("total"), rs.getLong("case_mode"), rs.getLong("contract_mode"),
                            rs.getLong("anonymous"), rs.getLong("member"), rs.getLong("completed"),
                            rs.getLong("failed"), rs.getLong("prompt_tokens"), rs.getLong("completion_tokens")
                    });
                },
                from.toString(), to.toString());

        List<DailyStats> result = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Object[] row = byDay.get(day.toString());
            if (row == null) {
                result.add(new DailyStats(day, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            } else {
                result.add(new DailyStats(day, (long) row[0], (long) row[1], (long) row[2], (long) row[3],
                        (long) row[4], (long) row[5], (long) row[6], (long) row[7], (long) row[8]));
            }
        }
        return result;
    }

    /** 將 day 之前的 identity_hash 置空以去識別化；當天（含）之後的列保留，避免刪帳號重登即重置當日配額。 */
    @Override
    public void anonymizeBefore(String identityHash, LocalDate day) {
        jdbc.update("UPDATE case_event SET identity_hash = NULL WHERE identity_hash = ? AND usage_day < ?",
                identityHash, day.toString());
    }

    /**
     * 全量去識別化（保存期限清理用）。不沿用預設的 anonymizeBefore(hash, LocalDate.MAX)：
     * usage_day 是 VARCHAR，LocalDate.MAX 轉字串為 "+999999999-12-31"，字典序反而小於 "2026-…"，
     * 條件會全部不成立，因此這裡直接省略日期條件。
     */
    @Override
    public void anonymize(String identityHash) {
        jdbc.update("UPDATE case_event SET identity_hash = NULL WHERE identity_hash = ?", identityHash);
    }

    @Override
    public String name() {
        return "jdbc";
    }
}
