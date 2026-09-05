package tw.lawgraph.auth;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * 會員資料儲存介面：登入時 upsert、首登告知確認、封鎖、帳號刪除與個資保存期限清理。
 * 實作見 JdbcMemberStore（正式環境）與 InMemoryMemberStore（測試／無資料庫環境）。
 */
public interface MemberStore {
    /** 全站判定日曆日（countActiveOn、保存期限排程）所用的時區。 */
    ZoneId ZONE = ZoneId.of("Asia/Taipei");

    /** upsert 結果：更新後的會員資料與本次是否為新建（首次登入）。 */
    record LoginResult(Member member, boolean created) {}

    /** 登入時 upsert：既有會員累加登入次數並刷新 email／姓名／頭像與最後登入時間，否則新建。 */
    LoginResult recordLogin(String sub, String email, String name, String picture, Instant now);

    /** 查詢單一會員；不存在回 Optional.empty()。 */
    Optional<Member> find(String sub);

    /** 記錄首登告知的確認時間；sub 不存在時靜默略過。 */
    void acknowledgeNotice(String sub, Instant now);

    /** 標記為使用授權排除方並記錄原因；sub 不存在時靜默略過。 */
    void block(String sub, String reason);

    /** 解除封鎖並清空原因；sub 不存在時靜默略過。登入時依名單同步狀態，避免 blocked 只能寫一次。 */
    void unblock(String sub);

    /** 刪除會員；確實刪到才回 true。 */
    boolean delete(String sub);

    /** 列出最後登入早於 cutoff 的會員 sub（刪除前需先對其事件去識別化）。 */
    List<String> inactiveSubs(Instant cutoff);

    /** 刪除最後登入早於 cutoff 的會員，回傳刪除筆數。 */
    int deleteInactiveBefore(Instant cutoff);

    /** 會員總數。 */
    long count();

    /** 最後登入落在該台北日曆日的會員數（當日活躍）。 */
    long countActiveOn(LocalDate day);

    /** 實作名稱（例如 "jdbc"、"memory"），供設定／記錄之用。 */
    String name();
}
