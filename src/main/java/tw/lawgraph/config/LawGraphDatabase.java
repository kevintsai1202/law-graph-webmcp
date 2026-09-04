package tw.lawgraph.config;

import javax.sql.DataSource;
import java.util.Optional;

/**
 * 全站共用的選配資料庫（Zeabur 同專案 PostgreSQL）。
 * 未設定 LAWGRAPH_DB_URL 時為空，各功能（每日 token 用量、OAuth 憑證）退回檔案儲存。
 * 不啟用 Spring Boot 的 DataSource 自動組態，避免沒有資料庫的本機開發啟動失敗。
 */
public record LawGraphDatabase(DataSource dataSource) {

    /** 有設定連線字串時回傳 DataSource。 */
    public Optional<DataSource> optional() {
        return Optional.ofNullable(dataSource);
    }

    /** 要求資料庫必須存在，否則以可讀訊息讓啟動失敗（呼叫端說明是哪個功能需要）。 */
    public DataSource require(String feature) {
        if (dataSource == null) {
            throw new IllegalStateException(feature + " 設定為 db，但未提供 lawgraph.db.url（LAWGRAPH_DB_URL）");
        }
        return dataSource;
    }
}
