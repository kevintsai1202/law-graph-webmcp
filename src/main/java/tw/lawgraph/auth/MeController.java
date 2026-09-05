package tw.lawgraph.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Instant;

/**
 * 揭露目前登入者給前端右上角選單：未登入回 loggedIn=false 與登入路徑。
 * 另提供首登告知確認（POST /api/me/notice-ack）與帳號刪除（DELETE /api/me）。
 */
@RestController
public class MeController {
    private static final Logger LOGGER = LoggerFactory.getLogger(MeController.class);

    /** 前端需要的身分摘要；firstLogin 為 true 時前端顯示首次登入告知。 */
    public record Me(boolean enabled, boolean loggedIn, String name, String email, String picture, String loginPath,
                     boolean blocked, String blockedMessage, boolean firstLogin) {
        /** 相容舊有 8 參數用法（未帶 firstLogin 時視為 false）。 */
        public Me(boolean enabled, boolean loggedIn, String name, String email, String picture, String loginPath,
                  boolean blocked, String blockedMessage) {
            this(enabled, loggedIn, name, email, picture, loginPath, blocked, blockedMessage, false);
        }
    }

    private final boolean enabled;
    private final AccessPolicy policy;
    /** 會員資料（首登告知狀態、帳號刪除）。 */
    private final MemberStore members;
    /** 使用事件（刪除帳號時一併去識別化）。 */
    private final UsageEventStore events;

    /** 有 Google 用戶端註冊才算啟用登入功能；policy 判定登入者是否為使用授權排除方。 */
    public MeController(ObjectProvider<ClientRegistrationRepository> registrations, AccessPolicy policy,
                        MemberStore members, UsageEventStore events) {
        this.enabled = registrations.getIfAvailable() != null;
        this.policy = policy;
        this.members = members;
        this.events = events;
    }

    /** GET /api/me：目前 session 的 Google 使用者（名稱、email、頭像）與首登告知狀態。 */
    @GetMapping("/api/me")
    public Me me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return new Me(enabled, false, null, null, null, SecurityConfig.LOGIN_PATH, false, null, false);
        String email = attribute(user, "email");
        boolean blocked = policy.isBlocked(email);
        boolean firstLogin = members.find(subject(user)).map(m -> m.noticeAcknowledgedAt() == null).orElse(false);
        return new Me(enabled, true, attribute(user, "name"), email, attribute(user, "picture"),
                SecurityConfig.LOGIN_PATH, blocked, blocked ? AccessPolicy.message(true) : null, firstLogin);
    }

    /** POST /api/me/notice-ack：記錄使用者已閱讀首次登入告知；未登入回 401。 */
    @PostMapping("/api/me/notice-ack")
    public ResponseEntity<Void> acknowledgeNotice(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return ResponseEntity.status(401).build();
        members.acknowledgeNotice(subject(user), Instant.now());
        return ResponseEntity.noContent().build();
    }

    /** DELETE /api/me：刪除會員資料、去識別化其使用事件並登出；未登入回 401。 */
    @DeleteMapping("/api/me")
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal OAuth2User user, HttpServletRequest request) {
        if (user == null) return ResponseEntity.status(401).build();
        String sub = subject(user);
        members.delete(sub);
        try {
            events.anonymize(sub);
        } catch (RuntimeException e) {
            LOGGER.warn("刪除帳號時事件去識別化失敗：{}", e.toString());
        }
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /** Google 帳號識別碼；沒有 sub 屬性時退回 principal 名稱。 */
    private static String subject(OAuth2User user) {
        return user.getAttributes().getOrDefault("sub", user.getName()).toString();
    }

    /** 安全取字串屬性。 */
    private static String attribute(OAuth2User user, String key) {
        Object value = user.getAttributes().get(key);
        return value == null ? null : value.toString();
    }
}
