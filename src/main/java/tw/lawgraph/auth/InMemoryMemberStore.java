package tw.lawgraph.auth;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** 以記憶體 Map 保存會員，語意與 JdbcMemberStore 相同，供測試或無資料庫環境使用（重啟即歸零）。 */
public final class InMemoryMemberStore implements MemberStore {
    /** countActiveOn 判定日曆日所用的時區。 */
    static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    /** googleSub -> 會員；ConcurrentHashMap 確保多執行緒下讀寫安全。 */
    private final ConcurrentHashMap<String, Member> members = new ConcurrentHashMap<>();

    /** 已存在就累加登入次數並刷新可變欄位，否則以 loginCount=1 新建。 */
    @Override
    public LoginResult recordLogin(String sub, String email, String name, String picture, Instant now) {
        boolean[] created = {false};
        Member member = members.compute(sub, (key, existing) -> {
            if (existing == null) {
                created[0] = true;
                return new Member(sub, email, name, picture, now, now, 1, false, null, null);
            }
            return new Member(sub, email, name, picture, existing.firstLoginAt(), now, existing.loginCount() + 1,
                    existing.blocked(), existing.blockedReason(), existing.noticeAcknowledgedAt());
        });
        return new LoginResult(member, created[0]);
    }

    @Override
    public Optional<Member> find(String sub) {
        return Optional.ofNullable(members.get(sub));
    }

    @Override
    public void acknowledgeNotice(String sub, Instant now) {
        members.computeIfPresent(sub, (key, m) -> new Member(m.googleSub(), m.email(), m.displayName(), m.pictureUrl(),
                m.firstLoginAt(), m.lastLoginAt(), m.loginCount(), m.blocked(), m.blockedReason(), now));
    }

    @Override
    public void block(String sub, String reason) {
        members.computeIfPresent(sub, (key, m) -> new Member(m.googleSub(), m.email(), m.displayName(), m.pictureUrl(),
                m.firstLoginAt(), m.lastLoginAt(), m.loginCount(), true, reason, m.noticeAcknowledgedAt()));
    }

    @Override
    public boolean delete(String sub) {
        return members.remove(sub) != null;
    }

    /** 依 sub 排序以取得穩定輸出，方便測試與記錄。 */
    @Override
    public List<String> inactiveSubs(Instant cutoff) {
        return members.values().stream().filter(m -> m.lastLoginAt().isBefore(cutoff))
                .map(Member::googleSub).sorted(Comparator.naturalOrder()).toList();
    }

    @Override
    public int deleteInactiveBefore(Instant cutoff) {
        List<String> stale = inactiveSubs(cutoff);
        stale.forEach(members::remove);
        return stale.size();
    }

    @Override
    public long count() {
        return members.size();
    }

    @Override
    public long countActiveOn(LocalDate day) {
        return members.values().stream().filter(m -> LocalDate.ofInstant(m.lastLoginAt(), ZONE).equals(day)).count();
    }

    @Override
    public String name() {
        return "memory";
    }
}
