package tw.lawgraph.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;

/** /api/me 的會員行為：首次登入告知旗標、告知確認、帳號刪除（連同事件去識別化）。 */
@WebMvcTest(controllers = MeController.class)
@Import({SecurityConfig.class, AccessPolicy.class, tw.lawgraph.api.ApiExceptionHandler.class, MeControllerMemberTest.Stores.class})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class MeControllerMemberTest {
    /** 以真實的記憶體會員儲存驗證讀寫串接。 */
    @TestConfiguration
    static class Stores {
        @Bean MemberStore memberStore() { return new InMemoryMemberStore(); }
    }

    @Autowired MockMvcTester mvc;
    @Autowired MemberStore members;
    @MockitoBean UsageEventStore events;

    /** 已登入的 Google 使用者（sub=s1）。 */
    private static org.springframework.test.web.servlet.request.RequestPostProcessor login() {
        return oauth2Login().attributes(a -> {
            a.put("sub", "s1");
            a.put("email", "k@example.com");
            a.put("name", "Kevin");
        });
    }

    /** 尚未確認告知的會員 firstLogin=true；確認後轉為 false。 */
    @Test void firstLoginFlagFlipsAfterNoticeAck() {
        members.recordLogin("s1", "k@example.com", "Kevin", null, Instant.parse("2026-09-05T02:00:00Z"));
        assertThat(mvc.get().uri("/api/me").with(login()).exchange())
                .bodyJson().extractingPath("$.firstLogin").isEqualTo(true);

        assertThat(mvc.post().uri("/api/me/notice-ack").with(login())).hasStatus(204);
        assertThat(members.find("s1").orElseThrow().noticeAcknowledgedAt()).isNotNull();

        assertThat(mvc.get().uri("/api/me").with(login()).exchange())
                .bodyJson().extractingPath("$.firstLogin").isEqualTo(false);
    }

    /** 未登入時 firstLogin 為 false，且告知確認回 401。 */
    @Test void anonymousHasNoFirstLoginAndCannotAck() {
        assertThat(mvc.get().uri("/api/me").exchange())
                .bodyJson().extractingPath("$.firstLogin").isEqualTo(false);
        assertThat(mvc.post().uri("/api/me/notice-ack")).hasStatus(401);
    }

    /** 刪除帳號：member 列消失、事件去識別化，回 204。 */
    @Test void deleteAccountRemovesMemberAndAnonymizesEvents() {
        members.recordLogin("s1", "k@example.com", "Kevin", null, Instant.parse("2026-09-05T02:00:00Z"));
        assertThat(mvc.delete().uri("/api/me").with(login())).hasStatus(204);
        assertThat(members.find("s1")).isEmpty();
        verify(events).anonymize("s1");
    }

    /** 事件去識別化失敗時整筆不刪：回 503 ACCOUNT_DELETE_FAILED，且會員列必須保留。 */
    @Test void deleteAccountFailsLoudlyWhenAnonymizeFails() {
        members.recordLogin("s1", "k@example.com", "Kevin", null, Instant.parse("2026-09-05T02:00:00Z"));
        org.mockito.Mockito.doThrow(new IllegalStateException("db down")).when(events).anonymize("s1");
        var rejected = mvc.delete().uri("/api/me").with(login()).exchange();
        assertThat(rejected).hasStatus(503);
        assertThat(rejected).bodyJson().extractingPath("$.error").isEqualTo("ACCOUNT_DELETE_FAILED");
        assertThat(members.find("s1")).isPresent();
    }

    /** 匿名刪除回 401。 */
    @Test void anonymousDeleteIsUnauthorized() {
        assertThat(mvc.delete().uri("/api/me")).hasStatus(401);
    }
}
