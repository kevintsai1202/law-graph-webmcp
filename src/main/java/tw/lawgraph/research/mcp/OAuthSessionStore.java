package tw.lawgraph.research.mcp;

import java.util.Optional;

/**
 * OAuth 長期憑證（client_id＋refresh token）的持久化介面。
 * access token 永遠只留在記憶體；這裡只存能在重啟、重佈後換回新 access token 的最小資料。
 */
public interface OAuthSessionStore {

    /** 讀取先前保存的憑證；沒有或已清除時為空。 */
    Optional<SavedSession> load();

    /** 覆寫保存最新憑證（refresh token 每次輪替後都要回寫）。 */
    void save(SavedSession session);

    /** 憑證被 provider 拒絕時清除，下一次啟動改走全新授權。 */
    void clear();

    /** 儲存方式名稱（file／jdbc），供 log 與狀態端點顯示。 */
    String name();

    /** 持久化的最小憑證組合；不覆寫 toString，避免 refresh token 進 log。 */
    record SavedSession(String clientId, String refreshToken) {
        @Override
        public String toString() {
            return "SavedSession[clientId=" + clientId + "]";
        }
    }
}
