package tw.lawgraph.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 登入成功處理器：把 Google 身分寫進 member 表、命中排除名單時封鎖，最後導回首頁。 */
class MemberLoginHandlerTest {
    /** 固定時鐘，讓 recordLogin 的時間可驗證。 */
    private static final Instant NOW = Instant.parse("2026-09-05T02:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    /** 建立帶指定屬性的 Google 登入 Authentication。 */
    private static OAuth2AuthenticationToken token(Map<String, Object> attributes) {
        var user = new DefaultOAuth2User(AuthorityUtils.createAuthorityList("ROLE_USER"), attributes, "sub");
        return new OAuth2AuthenticationToken(user, user.getAuthorities(), SecurityConfig.GOOGLE);
    }

    /** 一般登入者：寫入 member、不封鎖、導回首頁。 */
    @Test void recordsLoginAndRedirects() throws Exception {
        MemberStore store = mock(MemberStore.class);
        var policy = new AccessPolicy("", "");
        var response = mock(HttpServletResponse.class);
        new MemberLoginHandler(store, policy, clock).onAuthenticationSuccess(null, response,
                token(Map.of("sub", "g-1", "email", "k@example.com", "name", "Kevin", "picture", "https://img/a.png")));
        verify(store).recordLogin("g-1", "k@example.com", "Kevin", "https://img/a.png", NOW);
        verify(store, never()).block(anyString(), anyString());
        verify(store).unblock("g-1");
        verify(response).sendRedirect("/");
    }

    /** 命中使用授權排除名單：仍記錄登入，但額外標記封鎖。 */
    @Test void blocksExcludedFirm() throws Exception {
        MemberStore store = mock(MemberStore.class);
        var policy = new AccessPolicy("excluded-law.com.tw", "");
        var response = mock(HttpServletResponse.class);
        new MemberLoginHandler(store, policy, clock).onAuthenticationSuccess(null, response,
                token(Map.of("sub", "g-9", "email", "lawyer@excluded-law.com.tw", "name", "某律師")));
        verify(store).recordLogin("g-9", "lawyer@excluded-law.com.tw", "某律師", null, NOW);
        verify(store).block("g-9", AccessPolicy.ERROR_CODE);
        verify(store, never()).unblock(anyString());
        verify(response).sendRedirect("/");
    }

    /** 非 OAuth2 身分（理論上不會發生）只導頁，不碰 member 表。 */
    @Test void nonOAuth2PrincipalJustRedirects() throws Exception {
        MemberStore store = mock(MemberStore.class);
        var response = mock(HttpServletResponse.class);
        new MemberLoginHandler(store, new AccessPolicy("", ""), clock).onAuthenticationSuccess(null, response,
                new UsernamePasswordAuthenticationToken("u", "p", AuthorityUtils.NO_AUTHORITIES));
        verifyNoInteractions(store);
        verify(response).sendRedirect("/");
    }
}
