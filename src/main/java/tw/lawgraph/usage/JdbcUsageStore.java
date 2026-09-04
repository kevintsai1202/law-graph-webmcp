package tw.lawgraph.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 以關聯式資料庫（正式環境為 Zeabur PostgreSQL）保存每日累計，重佈、重啟都不會歸零。
 * 資料表 usage_daily 每天一列（欄位 usage_day，避開 DAY 保留字），方便日後查歷史用量；DDL 使用標準 SQL，測試以 H2 執行。
 */
public final class JdbcUsageStore implements UsageStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcUsageStore.class);
    private final JdbcTemplate jdbc;

    /** 建立時即確保資料表存在；資料庫不可用時直接拋錯讓啟動失敗，避免靜默改用不持久的計數。 */
    public JdbcUsageStore(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS usage_daily (
                  usage_day VARCHAR(10) PRIMARY KEY,
                  prompt_tokens BIGINT NOT NULL,
                  completion_tokens BIGINT NOT NULL,
                  updated_at TIMESTAMP NOT NULL
                )""");
        LOGGER.info("usage_daily 資料表就緒（JdbcUsageStore）");
    }

    @Override
    public Optional<DailyUsage> load(LocalDate day) {
        List<DailyUsage> rows = jdbc.query(
                "SELECT prompt_tokens, completion_tokens FROM usage_daily WHERE usage_day = ?",
                (rs, i) -> new DailyUsage(day, rs.getLong("prompt_tokens"), rs.getLong("completion_tokens")),
                day.toString());
        return rows.stream().findFirst();
    }

    /** 先 UPDATE、無列再 INSERT，避開各資料庫 UPSERT 語法差異。 */
    @Override
    public void save(DailyUsage usage) {
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update(
                "UPDATE usage_daily SET prompt_tokens = ?, completion_tokens = ?, updated_at = ? WHERE usage_day = ?",
                usage.promptTokens(), usage.completionTokens(), now, usage.day().toString());
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO usage_daily (usage_day, prompt_tokens, completion_tokens, updated_at) VALUES (?, ?, ?, ?)",
                    usage.day().toString(), usage.promptTokens(), usage.completionTokens(), now);
        }
    }

    @Override
    public String name() {
        return "jdbc";
    }
}
