package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;

/** 每人每日三次的案件配額：第四次回 429 DAILY_CASE_LIMIT 並說明原因；GET /api/quota 回報次數。 */
@WebMvcTest(controllers = {CaseController.class, QuotaController.class, tw.lawgraph.auth.MeController.class},
        properties = {"lawgraph.rate-limit-per-hour=100", "lawgraph.daily-cases-per-user=3", "lawgraph.daily-cases-per-member=5",
                "lawgraph.auth.blocked-email-domains=excluded-law.com.tw"})
@org.springframework.context.annotation.Import({tw.lawgraph.auth.SecurityConfig.class, QuotaIdentityResolver.class, tw.lawgraph.auth.AccessPolicy.class})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class DailyCaseQuotaControllerTest {
    @Autowired MockMvcTester mvc;
    @MockitoBean CaseService service;
    @MockitoBean CaseFileExtractor fileExtractor;
    @MockitoBean tw.lawgraph.usage.DailyTokenBudget budget;

    private static final String BODY = "{\"caseText\":\"A hit B\",\"locale\":\"zh-TW\"}";

    /** 三次成功後第四次被拒，訊息包含免費與造福更多人的說明；配額端點同步顯示 3/3。 */
    @Test void fourthCaseOfTheDayIsRejectedWithReason() {
        when(service.start(anyString(), any(), anyList(), anyString(), anyString()))
                .thenReturn(new CaseStatus("p1", "RUNNING", "BRAINSTORM", "zh-TW", null, null, null));
        for (int i = 0; i < 3; i++) {
            assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(BODY)).hasStatus(201);
        }
        var rejected = mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(BODY).exchange();
        assertThat(rejected).hasStatus(429);
        assertThat(rejected).bodyJson().extractingPath("$.error").isEqualTo("DAILY_CASE_LIMIT");
        assertThat(rejected).bodyJson().extractingPath("$.message").asString().contains("免費").contains("3");

        var quota = mvc.get().uri("/api/quota").exchange();
        assertThat(quota).hasStatusOk();
        assertThat(quota).bodyJson().extractingPath("$.used").isEqualTo(3);
        assertThat(quota).bodyJson().extractingPath("$.limit").isEqualTo(3);
        assertThat(quota).bodyJson().extractingPath("$.remaining").isEqualTo(0);
        assertThat(quota).bodyJson().extractingPath("$.exhausted").isEqualTo(true);
    }

    /** 尚未使用時配額端點回 0/3。 */
    @Test void quotaStartsEmpty() {
        var quota = mvc.get().uri("/api/quota").exchange();
        assertThat(quota).bodyJson().extractingPath("$.used").isEqualTo(0);
        assertThat(quota).bodyJson().extractingPath("$.remaining").isEqualTo(3);
    }

    /** 英文語系的拒絕訊息也要說明原因。 */
    @Test void rejectionMessageIsLocalized() {
        when(service.start(anyString(), any(), anyList(), anyString(), anyString()))
                .thenReturn(new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null));
        String en = "{\"caseText\":\"A hit B\",\"locale\":\"en\"}";
        for (int i = 0; i < 3; i++) mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(en).exchange();
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(en))
                .hasStatus(429).bodyJson().extractingPath("$.message").asString().contains("free");
    }

    /** 匿名 /api/quota 帶 loggedIn=false、memberLimit=5 與登入路徑，前端據此顯示登入好處。 */
    @Test void anonymousQuotaExposesLoginBenefit() {
        var quota = mvc.get().uri("/api/quota").exchange();
        assertThat(quota).bodyJson().extractingPath("$.loggedIn").isEqualTo(false);
        assertThat(quota).bodyJson().extractingPath("$.memberLimit").isEqualTo(5);
        assertThat(quota).bodyJson().extractingPath("$.loginPath").isEqualTo("/oauth2/authorization/google");
        var me = mvc.get().uri("/api/me").exchange();
        assertThat(me).hasStatusOk();
        assertThat(me).bodyJson().extractingPath("$.loggedIn").isEqualTo(false);
    }

    /** Google 登入者以帳號計數、上限 5，且 /api/me 回名稱與頭像。 */
    @Test void memberGetsHigherLimitAndProfile() {
        when(service.start(anyString(), any(), anyList(), anyString(), anyString()))
                .thenReturn(new CaseStatus("p1", "RUNNING", "BRAINSTORM", "zh-TW", null, null, null));
        var login = oauth2Login().attributes(a -> { a.put("sub", "g-123"); a.put("name", "Kevin"); a.put("email", "k@example.com"); a.put("picture", "https://img/x.png"); });
        for (int i = 0; i < 4; i++) {
            assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(BODY).with(login)).hasStatus(201);
        }
        var quota = mvc.get().uri("/api/quota").with(login).exchange();
        assertThat(quota).bodyJson().extractingPath("$.loggedIn").isEqualTo(true);
        assertThat(quota).bodyJson().extractingPath("$.used").isEqualTo(4);
        assertThat(quota).bodyJson().extractingPath("$.limit").isEqualTo(5);
        var me = mvc.get().uri("/api/me").with(login).exchange();
        assertThat(me).bodyJson().extractingPath("$.name").isEqualTo("Kevin");
        assertThat(me).bodyJson().extractingPath("$.picture").isEqualTo("https://img/x.png");
        // 同一台機器的匿名配額不受會員使用影響
        assertThat(mvc.get().uri("/api/quota").exchange()).bodyJson().extractingPath("$.used").isEqualTo(0);
    }

    /** 使用授權排除方以 Google 登入：案件 API 回 403 LICENSE_EXCLUDED，/api/me 標記 blocked 與訊息，且不扣配額、不進服務層。 */
    @Test void excludedFirmIsRefused() {
        var login = oauth2Login().attributes(a -> { a.put("sub", "g-9"); a.put("name", "某律師"); a.put("email", "lawyer@excluded-law.com.tw"); });
        var rejected = mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(BODY).with(login).exchange();
        assertThat(rejected).hasStatus(403);
        assertThat(rejected).bodyJson().extractingPath("$.error").isEqualTo("LICENSE_EXCLUDED");
        assertThat(rejected).bodyJson().extractingPath("$.message").asString().contains("經兆國際法律事務所");
        var me = mvc.get().uri("/api/me").with(login).exchange();
        assertThat(me).bodyJson().extractingPath("$.blocked").isEqualTo(true);
        assertThat(me).bodyJson().extractingPath("$.blockedMessage").asString().contains("使用授權");
        org.mockito.Mockito.verify(service, org.mockito.Mockito.never()).start(anyString(), any(), anyList(), anyString(), anyString());
    }
}
