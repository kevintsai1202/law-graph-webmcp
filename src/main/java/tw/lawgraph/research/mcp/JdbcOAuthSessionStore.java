package tw.lawgraph.research.mcp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 以關聯式資料庫（正式環境為 Zeabur PostgreSQL）保存 OAuth refresh token，重佈、重啟後不必再人工授權。
 * 資料表 oauth_session 每個 provider 一列；DDL 使用標準 SQL，測試以 H2 執行。
 */
public final class JdbcOAuthSessionStore implements OAuthSessionStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcOAuthSessionStore.class);
    private final JdbcTemplate jdbc;
    /** 列鍵：同一資料庫可保存多個 MCP provider 的憑證。 */
    private final String provider;

    /** 建立時即確保資料表存在；資料庫不可用時直接拋錯讓啟動失敗，避免靜默退回不持久的儲存。 */
    public JdbcOAuthSessionStore(DataSource dataSource, String provider) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.provider = provider;
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS oauth_session (
                  provider VARCHAR(64) PRIMARY KEY,
                  client_id VARCHAR(255) NOT NULL,
                  refresh_token VARCHAR(4096) NOT NULL,
                  updated_at TIMESTAMP NOT NULL
                )""");
        LOGGER.info("oauth_session 資料表就緒（JdbcOAuthSessionStore, provider={}）", provider);
    }

    @Override
    public Optional<SavedSession> load() {
        List<SavedSession> rows = jdbc.query(
                "SELECT client_id, refresh_token FROM oauth_session WHERE provider = ?",
                (rs, i) -> new SavedSession(rs.getString("client_id"), rs.getString("refresh_token")),
                provider);
        return rows.stream().findFirst();
    }

    /** 先 UPDATE、無列再 INSERT，避開各資料庫 UPSERT 語法差異。 */
    @Override
    public void save(SavedSession session) {
        if (session == null || session.refreshToken() == null || session.refreshToken().isBlank()) return;
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update(
                "UPDATE oauth_session SET client_id = ?, refresh_token = ?, updated_at = ? WHERE provider = ?",
                session.clientId(), session.refreshToken(), now, provider);
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO oauth_session (provider, client_id, refresh_token, updated_at) VALUES (?, ?, ?, ?)",
                    provider, session.clientId(), session.refreshToken(), now);
        }
    }

    @Override
    public void clear() {
        jdbc.update("DELETE FROM oauth_session WHERE provider = ?", provider);
    }

    @Override
    public String name() {
        return "jdbc";
    }
}
