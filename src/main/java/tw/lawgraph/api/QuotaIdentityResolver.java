package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

/**
 * 決定每日配額的計數身分：已用 Google 登入者以帳號識別、上限較高；匿名者以來源 IP 識別、上限較低。
 * 本站免費開放，登入的好處就是每天能多分析幾次。
 */
@Component
public class QuotaIdentityResolver {
    /** 計數 key、適用上限與是否為登入會員。 */
    public record Identity(String key, int limit, boolean member) {}

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
