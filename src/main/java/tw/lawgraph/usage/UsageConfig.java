package tw.lawgraph.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tw.lawgraph.config.LawGraphDatabase;

import java.time.Clock;

/** 每日 token 預算與用量監聽器的 bean 設定。 */
@Configuration
public class UsageConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(UsageConfig.class);

    /**
     * 讀取每日上限、手動暫停旗標與儲存設定。
     * store=db 時用全站共用的 PostgreSQL（lawgraph.db.*，Zeabur 同專案的 postgresql 服務），重佈不歸零；
     * store=file 時寫本機 JSON 檔（只撐過同容器重啟）。
     */
    @Bean
    public DailyTokenBudget dailyTokenBudget(
            @Value("${lawgraph.usage.daily-token-limit:2000000}") long dailyTokenLimit,
            @Value("${lawgraph.usage.paused:false}") boolean paused,
            @Value("${lawgraph.usage.store:file}") String store,
            @Value("${lawgraph.usage.path:.data/token-usage.json}") String path,
            LawGraphDatabase database) {
        UsageStore usageStore;
        if ("db".equalsIgnoreCase(store)) {
            usageStore = new JdbcUsageStore(database.require("lawgraph.usage.store"));
            LOGGER.info("每日 token 用量改由資料庫保存（store=db）");
        } else {
            usageStore = new FileUsageStore(path);
            LOGGER.info("每日 token 用量以檔案保存（store=file，path={}）；容器重佈會歸零", path);
        }
        return new DailyTokenBudget(dailyTokenLimit, paused, usageStore, Clock.system(DailyTokenBudget.ZONE));
    }

    /**
     * case_event 事件儲存：有設定資料庫就落地 PostgreSQL（統計與配額跨重啟保存），
     * 否則退回記憶體版並警告，避免沒有資料庫的本機開發無法啟動。
     */
    @Bean
    public UsageEventStore usageEventStore(LawGraphDatabase database) {
        return database.optional().<UsageEventStore>map(JdbcUsageEventStore::new).orElseGet(() -> {
            LOGGER.warn("未設定資料庫，統計與配額只存記憶體，重啟歸零");
            return new InMemoryUsageEventStore();
        });
    }

    /** 註冊 Embabel 事件監聽器以累計 LLM 用量，並把 token 增量回寫 case_event。 */
    @Bean
    public TokenUsageListener tokenUsageListener(DailyTokenBudget budget, UsageEventStore events) {
        return new TokenUsageListener(budget, events);
    }
}
