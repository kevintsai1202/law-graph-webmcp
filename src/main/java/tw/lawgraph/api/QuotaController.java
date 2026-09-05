package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.lawgraph.auth.SecurityConfig;

/** 揭露呼叫端今日的案件配額（已用／上限／剩餘）與身分，供前端顯示次數、限制原因與登入好處。 */
@RestController
public class QuotaController {
    /** 前端需要的配額視圖：含是否登入、登入後的上限與登入路徑。 */
    public record QuotaView(String date, int used, int limit, int remaining, boolean exhausted,
                            boolean loggedIn, int memberLimit, String loginPath) {}

    private final DailyCaseQuota quota;
    private final QuotaIdentityResolver identities;

    /** 注入配額計數器與身分解析。 */
    public QuotaController(DailyCaseQuota quota, QuotaIdentityResolver identities) {
        this.quota = quota;
        this.identities = identities;
    }

    /** GET /api/quota：依目前身分（Google 帳號或 IP）回今日配額。 */
    @GetMapping("/api/quota")
    public QuotaView quota(HttpServletRequest http) {
        var identity = identities.resolve(http);
        var snapshot = quota.snapshot(identity.hash(), identity.limit());
        return new QuotaView(snapshot.date(), snapshot.used(), snapshot.limit(), snapshot.remaining(), snapshot.exhausted(),
                identity.member(), identities.memberLimit(), SecurityConfig.LOGIN_PATH);
    }
}
