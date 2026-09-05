package tw.lawgraph.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;

/**
 * Google 登入成功後的處理：把身分 upsert 進 member 表（首次登入即建檔），
 * 命中使用授權排除名單時一併標記封鎖，最後導回首頁。
 * 寫入失敗不得擋住登入流程，因此捕捉例外記錄警告後照常導頁。
 */
public class MemberLoginHandler implements AuthenticationSuccessHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(MemberLoginHandler.class);

    private final MemberStore store;
    private final AccessPolicy policy;
    /** 可注入固定時鐘以利測試。 */
    private final Clock clock;

    public MemberLoginHandler(MemberStore store, AccessPolicy policy, Clock clock) {
        this.store = store;
        this.policy = policy;
        this.clock = clock;
    }

    /** 取 sub、email、name、picture 寫入會員資料；非 OAuth2 身分只導頁。 */
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (authentication != null && authentication.getPrincipal() instanceof OAuth2User user) {
            try {
                Map<String, Object> attributes = user.getAttributes();
                String sub = string(attributes.get("sub"), user.getName());
                String email = string(attributes.get("email"), null);
                var result = store.recordLogin(sub, email, string(attributes.get("name"), null),
                        string(attributes.get("picture"), null), clock.instant());
                // 每次登入都依名單同步封鎖狀態：命中就封鎖，未命中就解除（名單移除後要能恢復使用）。
                if (policy.isBlocked(email)) store.block(sub, AccessPolicy.ERROR_CODE);
                else store.unblock(sub);
                // 不記 sub／email（個資），只記身分雜湊前 8 碼供對照。
                if (result != null && result.created())
                    LOGGER.info("新會員首次登入：id={}", tw.lawgraph.usage.IdentityHash.of("user:" + sub).substring(0, 8));
            } catch (RuntimeException e) {
                LOGGER.warn("會員登入記錄失敗，不影響登入：{}", e.getClass().getSimpleName());
            }
        }
        response.sendRedirect("/");
    }

    /** null 安全的字串轉換。 */
    private static String string(Object value, String fallback) {
        return value == null ? fallback : value.toString();
    }
}
