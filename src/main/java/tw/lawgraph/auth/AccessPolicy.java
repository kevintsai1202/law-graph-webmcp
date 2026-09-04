package tw.lawgraph.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 使用授權：與 law-powers 技能包相同，本站無償授權所有人使用，唯經兆國際法律事務所除外。
 * 以登入者的 Google email（整個網域或特定信箱）判定；名單由設定提供，比對不分大小寫。
 */
@Component
public class AccessPolicy {
    /** 被排除方的名稱（顯示用）。 */
    public static final String EXCLUDED_PARTY = "經兆國際法律事務所";
    /** 拒絕時的錯誤代碼。 */
    public static final String ERROR_CODE = "LICENSE_EXCLUDED";

    /** 被排除的 email 網域（小寫，不含 @）。 */
    private final Set<String> blockedDomains;
    /** 被排除的個別信箱（小寫）。 */
    private final Set<String> blockedEmails;

    /** 由逗號分隔的設定建立名單。 */
    public AccessPolicy(@Value("${lawgraph.auth.blocked-email-domains:}") String domains,
                        @Value("${lawgraph.auth.blocked-emails:}") String emails) {
        this.blockedDomains = split(domains).stream().map(d -> d.replaceFirst("^@", "")).collect(Collectors.toSet());
        this.blockedEmails = split(emails);
    }

    /** 判定 email 是否屬於被排除方。 */
    public boolean isBlocked(String email) {
        if (email == null || email.isBlank()) return false;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (blockedEmails.contains(normalized)) return true;
        int at = normalized.lastIndexOf('@');
        if (at < 0) return false;
        String domain = normalized.substring(at + 1);
        return blockedDomains.stream().anyMatch(d -> domain.equals(d) || domain.endsWith("." + d));
    }

    /** 目前 SecurityContext 的登入者是否被排除；未登入一律 false。 */
    public boolean currentUserBlocked() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof OAuth2User user) {
            Object email = user.getAttributes().get("email");
            return email != null && isBlocked(email.toString());
        }
        return false;
    }

    /** 拒絕訊息（與技能包停止時的回覆一致）。 */
    public static String message(boolean zh) {
        return zh ? "依本專案使用授權，本服務不提供" + EXCLUDED_PARTY + "使用。"
                  : "Under this project's license, this service is not available to " + EXCLUDED_PARTY + ".";
    }

    /** 逗號分隔 → 去空白、小寫、去空值。 */
    private static Set<String> split(String value) {
        if (value == null || value.isBlank()) return Set.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    }
}
