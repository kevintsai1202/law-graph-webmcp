package tw.lawgraph.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 以關聯式資料庫保存會員（正式環境為 Zeabur PostgreSQL，測試以 H2 執行）。
 * recordLogin 先 UPDATE 再 INSERT 以達成 upsert；countActiveOn 以台北日曆日換算成時間區間後查詢。
 */
public final class JdbcMemberStore implements MemberStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcMemberStore.class);
    /** 全欄位查詢的共用片段。 */
    private static final String SELECT = "SELECT google_sub, email, display_name, picture_url, first_login_at, "
            + "last_login_at, login_count, blocked, blocked_reason, notice_acknowledged_at FROM member";

    private final JdbcTemplate jdbc;

    /** 建立時即確保 member 資料表與索引存在。 */
    public JdbcMemberStore(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS member (
                  google_sub VARCHAR(64) PRIMARY KEY,
                  email VARCHAR(255),
                  display_name VARCHAR(255),
                  picture_url VARCHAR(1024),
                  first_login_at TIMESTAMP NOT NULL,
                  last_login_at TIMESTAMP NOT NULL,
                  login_count INT NOT NULL DEFAULT 1,
                  blocked BOOLEAN NOT NULL DEFAULT FALSE,
                  blocked_reason VARCHAR(255),
                  notice_acknowledged_at TIMESTAMP NULL
                )""");
        jdbc.execute("CREATE INDEX IF NOT EXISTS member_last_login ON member(last_login_at)");
        LOGGER.info("member 資料表就緒（JdbcMemberStore）");
    }

    /** 一列 → Member。 */
    private static final RowMapper<Member> MAPPER = (ResultSet rs, int rowNum) -> new Member(
            rs.getString("google_sub"), rs.getString("email"), rs.getString("display_name"), rs.getString("picture_url"),
            instant(rs, "first_login_at"), instant(rs, "last_login_at"), rs.getInt("login_count"),
            rs.getBoolean("blocked"), rs.getString("blocked_reason"), instant(rs, "notice_acknowledged_at"));

    /** 可為 null 的 TIMESTAMP 轉 Instant。 */
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    /** 先 UPDATE（既有會員累加次數並刷新可變欄位），無列更新才 INSERT 新會員。 */
    @Override
    public LoginResult recordLogin(String sub, String email, String name, String picture, Instant now) {
        int updated = jdbc.update(
                "UPDATE member SET email = ?, display_name = ?, picture_url = ?, last_login_at = ?, "
                        + "login_count = login_count + 1 WHERE google_sub = ?",
                email, name, picture, Timestamp.from(now), sub);
        if (updated == 0) {
            jdbc.update("INSERT INTO member (google_sub, email, display_name, picture_url, first_login_at, "
                            + "last_login_at, login_count, blocked, blocked_reason, notice_acknowledged_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, 1, FALSE, NULL, NULL)",
                    sub, email, name, picture, Timestamp.from(now), Timestamp.from(now));
        }
        return new LoginResult(find(sub).orElseThrow(), updated == 0);
    }

    @Override
    public Optional<Member> find(String sub) {
        return jdbc.query(SELECT + " WHERE google_sub = ?", MAPPER, sub).stream().findFirst();
    }

    @Override
    public void acknowledgeNotice(String sub, Instant now) {
        jdbc.update("UPDATE member SET notice_acknowledged_at = ? WHERE google_sub = ?", Timestamp.from(now), sub);
    }

    @Override
    public void block(String sub, String reason) {
        jdbc.update("UPDATE member SET blocked = TRUE, blocked_reason = ? WHERE google_sub = ?", reason, sub);
    }

    @Override
    public void unblock(String sub) {
        jdbc.update("UPDATE member SET blocked = FALSE, blocked_reason = NULL WHERE google_sub = ?", sub);
    }

    @Override
    public boolean delete(String sub) {
        return jdbc.update("DELETE FROM member WHERE google_sub = ?", sub) > 0;
    }

    /** 依 sub 排序回傳，輸出穩定方便記錄與測試。 */
    @Override
    public List<String> inactiveSubs(Instant cutoff) {
        return jdbc.queryForList("SELECT google_sub FROM member WHERE last_login_at < ? ORDER BY google_sub",
                String.class, Timestamp.from(cutoff));
    }

    @Override
    public int deleteInactiveBefore(Instant cutoff) {
        return jdbc.update("DELETE FROM member WHERE last_login_at < ?", Timestamp.from(cutoff));
    }

    @Override
    public long count() {
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM member", Long.class);
        return total == null ? 0 : total;
    }

    /** 台北日曆日換算為 [當日 00:00, 隔日 00:00) 的時間區間查詢。 */
    @Override
    public long countActiveOn(LocalDate day) {
        Instant from = day.atStartOfDay(MemberStore.ZONE).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(MemberStore.ZONE).toInstant();
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM member WHERE last_login_at >= ? AND last_login_at < ?",
                Long.class, Timestamp.from(from), Timestamp.from(to));
        return total == null ? 0 : total;
    }

    @Override
    public String name() {
        return "jdbc";
    }
}
