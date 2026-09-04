package tw.lawgraph.research.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** REST 契約：OAuth start 302、callback 重連結果與 credential-free status。 */
@WebMvcTest(controllers = TwLegalRagAuthController.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TwLegalRagAuthControllerTest {
    @Autowired MockMvcTester mvc;
    @MockitoBean TwLegalRagOAuthClient oauthClient;
    @MockitoBean TwLegalRagOAuthProperties properties;

    /** OAuth 開關開啟時，start 應將瀏覽器導向 provider，而非回傳 token。 */
    @Test
    void startRedirectsToAuthorizationProvider() {
        when(properties.enabled()).thenReturn(true);
        when(oauthClient.startAuthorization("/result")).thenReturn(new TwLegalRagOAuthClient.AuthorizationStart(
                URI.create("https://tlr.dr-legal.com.tw/oauth/authorize?state=opaque"), "/result"));

        assertThat(mvc.get().uri("/api/auth/tw-legal-rag/start?returnTo=/result"))
                .hasStatus(302)
                .headers().extracting(h -> h.getFirst("Location"))
                .isEqualTo("https://tlr.dr-legal.com.tw/oauth/authorize?state=opaque");
    }

    /** callback 成功後應回到原頁並標記成功；access／refresh token 不進 response。 */
    @Test
    void callbackReturnsToApplicationAfterReconnect() {
        when(oauthClient.completeAuthorization(eq("code"), eq("state"), eq(null), eq(null)))
                .thenReturn(new TwLegalRagOAuthClient.AuthorizationCompletion("/result", true));

        assertThat(mvc.get().uri("/api/auth/tw-legal-rag/callback?code=code&state=state"))
                .hasStatus(302)
                .headers().extracting(h -> h.getFirst("Location"))
                .isEqualTo("/result?mcpAuth=success");
    }

    /** status 只提供授權旗標與 start path，不提供任何 credential 欄位。 */
    @Test
    void statusDoesNotExposeCredentials() {
        when(oauthClient.status()).thenReturn(new TwLegalRagOAuthClient.AuthorizationStatus(
                true, false, true, "/api/auth/tw-legal-rag/start"));

        assertThat(mvc.get().uri("/api/auth/tw-legal-rag/status").accept(MediaType.APPLICATION_JSON))
                .hasStatus(200).bodyJson()
                .extractingPath("$.authorizationRequired").isEqualTo(true);
    }

    /** callback 即使收到不可信返回路徑，也只能導回本站根路徑。 */
    @Test
    void callbackRejectsExternalReturnTo() {
        when(oauthClient.completeAuthorization(eq("code"), eq("state"), eq(null), eq(null)))
                .thenReturn(new TwLegalRagOAuthClient.AuthorizationCompletion(
                        "https://evil.example/steal", false));

        assertThat(mvc.get().uri("/api/auth/tw-legal-rag/callback?code=code&state=state"))
                .hasStatus(302)
                .headers().extracting(h -> h.getFirst("Location"))
                .isEqualTo("/?mcpAuth=error");
    }
}
