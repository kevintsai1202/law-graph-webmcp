package tw.lawgraph.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tw.lawgraph.config.LawGraphDatabase;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Clock;
import java.time.ZoneId;

/** 會員儲存、登入處理器與個資保存期限排程的 bean 設定。 */
@Configuration
public class MemberConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(MemberConfig.class);
    /** 全站以台北時區判定日曆日與排程時間。 */
    public static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    /** 有設定資料庫就落地 PostgreSQL，否則退回記憶體版並警告，避免沒有資料庫的本機開發無法啟動。 */
    @Bean
    public MemberStore memberStore(LawGraphDatabase database) {
        return database.optional().<MemberStore>map(JdbcMemberStore::new).orElseGet(() -> {
            LOGGER.warn("未設定資料庫，會員資料只存記憶體，重啟歸零");
            return new InMemoryMemberStore();
        });
    }

    /** 登入成功後 upsert 會員並導回首頁。 */
    @Bean
    public MemberLoginHandler memberLoginHandler(MemberStore store, AccessPolicy policy) {
        return new MemberLoginHandler(store, policy, Clock.system(ZONE));
    }

    /** 個資保存期限清理排程。 */
    @Bean
    public MemberRetentionJob memberRetentionJob(MemberStore store, UsageEventStore events,
                                                 @Value("${lawgraph.member.retention-days:365}") int retentionDays) {
        return new MemberRetentionJob(store, events, retentionDays, Clock.system(ZONE));
    }
}
