package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import tw.lawgraph.usage.IdentityHash;

/**
 * 決定每日配額的計數身分：已用 Google 登入者以帳號識別、上限較高；匿名者以來源 IP 識別、上限較低。
 * 本站免費開放，登入的好處就是每天能多分析幾次。
 */
@Component
public class QuotaIdentityResolver {
    /** 計數 key（保留供記錄／除錯）、適用上限與是否為登入會員。 */
    public record Identity(String key, int limit, boolean member) {
        /** 統計用的身分類別：member（登入）或 anonymous（匿名）。 */
        public String kind() { return member ? "member" : "anonymous"; }

        /**
         * 寫進 case_event 與配額計數用的身分識別：
         * 會員取 Google sub 原值（本來就不是個資明碼且需可跨裝置累計），匿名者把 IP 雜湊掉避免落地原始 IP。
         */
        public String hash() {
            return member ? key.substring("user:".length()) : IdentityHash.of(key);
        }
    }

    private final int anonymousLimit;
    private final int memberLimit;

    /** 匿名與登入會員的每日上限（0 代表不限制）。 */
    public QuotaIdentityResolver(@Value("${lawgraph.daily-cases-per-user:1}") int anonymousLimit,
                                 @Value("${lawgraph.daily-cases-per-member:5}") int memberLimit) {
        this.anonymousLimit = anonymousLimit;
        this.memberLimit = memberLimit;
    }

    /** 依目前 SecurityContext 與請求決定身分。 */
    public Identity resolve(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof OAuth2User user) {
            Object subject = user.getAttributes().getOrDefault("sub", user.getName());
            return new Identity("user:" + subject, memberLimit, true);
        }
        return new Identity("ip:" + CaseController.clientIp(request), anonymousLimit, false);
    }

    /** 匿名上限。 */
    public int anonymousLimit() { return anonymousLimit; }

    /** 會員上限。 */
    public int memberLimit() { return memberLimit; }
}
