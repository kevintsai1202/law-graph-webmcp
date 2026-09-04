package tw.lawgraph.auth;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 揭露目前登入者給前端右上角選單：未登入回 loggedIn=false 與登入路徑。 */
@RestController
public class MeController {
    /** 前端需要的身分摘要。 */
    public record Me(boolean enabled, boolean loggedIn, String name, String email, String picture, String loginPath,
                     boolean blocked, String blockedMessage) {}

    private final boolean enabled;
    private final AccessPolicy policy;

    /** 有 Google 用戶端註冊才算啟用登入功能；policy 判定登入者是否為使用授權排除方。 */
    public MeController(ObjectProvider<ClientRegistrationRepository> registrations, AccessPolicy policy) {
        this.enabled = registrations.getIfAvailable() != null;
        this.policy = policy;
    }

    /** GET /api/me：目前 session 的 Google 使用者（名稱、email、頭像）。 */
    @GetMapping("/api/me")
    public Me me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return new Me(enabled, false, null, null, null, SecurityConfig.LOGIN_PATH, false, null);
        String email = attribute(user, "email");
        boolean blocked = policy.isBlocked(email);
        return new Me(enabled, true, attribute(user, "name"), email, attribute(user, "picture"),
                SecurityConfig.LOGIN_PATH, blocked, blocked ? AccessPolicy.message(true) : null);
    }

    /** 安全取字串屬性。 */
    private static String attribute(OAuth2User user, String key) {
        Object value = user.getAttributes().get(key);
        return value == null ? null : value.toString();
    }
}
