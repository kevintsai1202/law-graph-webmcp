package tw.lawgraph.research.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** JdbcOAuthSessionStore 以 H2（PostgreSQL 相容模式）驗證：refresh token 跨「重佈」可讀回、覆寫與清除。 */
class JdbcOAuthSessionStoreTest {

    /** 每個測試用獨立的記憶體資料庫。 */
    private static DriverManagerDataSource h2(String name) {
        return new DriverManagerDataSource("jdbc:h2:mem:" + name + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
    }

    /** 保存後由新的 store（模擬重佈）讀回；再次保存只覆寫同一列。 */
    @Test
    void savesOverwritesAndReloadsAcrossInstances() {
        var dataSource = h2("oauth_reload");
        var store = new JdbcOAuthSessionStore(dataSource, "tw-legal-rag");
        assertTrue(store.load().isEmpty(), "尚未授權時應為空");

        store.save(new OAuthSessionStore.SavedSession("client-1", "refresh-1"));
        store.save(new OAuthSessionStore.SavedSession("client-1", "refresh-2"));

        var reopened = new JdbcOAuthSessionStore(dataSource, "tw-legal-rag");
        var saved = reopened.load().orElseThrow();
        assertEquals("client-1", saved.clientId());
        assertEquals("refresh-2", saved.refreshToken(), "第二次保存應覆寫第一次");
        assertEquals("jdbc", reopened.name());
        assertTrue(new JdbcOAuthSessionStore(dataSource, "other-provider").load().isEmpty(), "不同 provider 互不干擾");
    }

    /** 清除後讀回為空，下一次啟動應重新走授權。 */
    @Test
    void clearRemovesSavedSession() {
        var dataSource = h2("oauth_clear");
        var store = new JdbcOAuthSessionStore(dataSource, "tw-legal-rag");
        store.save(new OAuthSessionStore.SavedSession("client-1", "refresh-1"));
        store.clear();
        assertTrue(new JdbcOAuthSessionStore(dataSource, "tw-legal-rag").load().isEmpty());
    }
}
