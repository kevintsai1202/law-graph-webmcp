package tw.lawgraph.auth;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 安全設定：全站維持匿名可用（登入只是提高每日配額的加分項），
 * 有設定 Google client id／secret 時才啟用 Google 登入；沒有就完全不掛 OAuth2 流程。
 * 登入成功回首頁；登出走 POST /logout 後回首頁。
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    /** Google 登入的 registrationId；callback 為 {baseUrl}/login/oauth2/code/google。 */
    public static final String GOOGLE = "google";
    /** 前端導向登入的路徑。 */
    public static final String LOGIN_PATH = "/oauth2/authorization/" + GOOGLE;

    /** 只有 lawgraph.auth.google.client-id 非空時才建立 Google 用戶端註冊。 */
    @Bean
    @ConditionalOnExpression("!'${lawgraph.auth.google.client-id:}'.isBlank()")
    public ClientRegistrationRepository googleClientRegistrations(
            @Value("${lawgraph.auth.google.client-id}") String clientId,
            @Value("${lawgraph.auth.google.client-secret:}") String clientSecret) {
        ClientRegistration google = CommonOAuth2Provider.GOOGLE.getBuilder(GOOGLE)
                .clientId(clientId.trim())
                .clientSecret(clientSecret.trim())
                .scope("openid", "profile", "email")
                .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    /** 全部端點 permitAll；API 由前端 fetch 呼叫、以 session cookie 辨識身分，因此關閉 CSRF 與預設登入頁。 */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   ObjectProvider<ClientRegistrationRepository> registrations,
                                                   ObjectProvider<MemberLoginHandler> loginHandlers) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.logoutUrl("/logout").logoutSuccessUrl("/").permitAll());
        if (registrations.getIfAvailable() != null) {
            // 有會員登入處理器就交給它（登入時 upsert 會員後自行導回首頁），否則沿用預設導向。
            http.oauth2Login(oauth -> {
                MemberLoginHandler handler = loginHandlers.getIfAvailable();
                if (handler != null) oauth.successHandler(handler);
                else oauth.defaultSuccessUrl("/", true);
            });
        }
        http.requestCache(Customizer.withDefaults());
        return http.build();
    }
}
