package tw.lawgraph.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** 建立全站共用的選配 DataSource；低頻寫入，DriverManagerDataSource 每次開連線即可，不需連線池。 */
@Configuration
public class LawGraphDatabaseConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(LawGraphDatabaseConfig.class);

    /** 讀取 lawgraph.db.*（環境變數 LAWGRAPH_DB_URL／USER／PASSWORD）；未設定 URL 時回傳空的持有物件。 */
    @Bean
    public LawGraphDatabase lawGraphDatabase(
            @Value("${lawgraph.db.url:}") String url,
            @Value("${lawgraph.db.username:}") String username,
            @Value("${lawgraph.db.password:}") String password) {
        if (url == null || url.isBlank()) {
            LOGGER.info("未設定 lawgraph.db.url，持久化功能退回檔案儲存");
            return new LawGraphDatabase(null);
        }
        LOGGER.info("共用資料庫已設定（lawgraph.db.url）");
        return new LawGraphDatabase(new DriverManagerDataSource(url, username, password));
    }
}
