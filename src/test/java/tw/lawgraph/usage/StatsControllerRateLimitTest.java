package tw.lawgraph.usage;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.api.RateLimiter;
import tw.lawgraph.auth.MemberStore;
import tw.lawgraph.auth.SecurityConfig;

import java.time.Clock;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** GET /api/stats 的伺服端限流：超過每小時上限回 429 RATE_LIMITED。 */
@WebMvcTest(controllers = StatsController.class)
@Import({SecurityConfig.class, StatsControllerRateLimitTest.Limits.class})
class StatsControllerRateLimitTest {
    /** 把統計限流上限壓到 2 次／小時，方便驗證第 3 次被擋。 */
    @TestConfiguration
    static class Limits {
        @Bean RateLimiter statsRateLimiter() { return new RateLimiter(2, Clock.systemUTC()); }
    }

    @Autowired MockMvcTester mvc;
    @MockitoBean UsageEventStore events;
    @MockitoBean MemberStore members;

    /** 上限 2：前兩次成功，第三次回 429 且錯誤碼為 RATE_LIMITED。 */
    @Test void thirdCallWithinTheHourIsRateLimited() {
        when(events.dailyStats(any(), any())).thenReturn(List.of());
        when(events.name()).thenReturn("memory");

        assertThat(mvc.get().uri("/api/stats?days=1").exchange()).hasStatusOk();
        assertThat(mvc.get().uri("/api/stats?days=1").exchange()).hasStatusOk();

        var blocked = mvc.get().uri("/api/stats?days=1").exchange();
        assertThat(blocked).hasStatus(429);
        assertThat(blocked).bodyJson().extractingPath("$.error").isEqualTo("RATE_LIMITED");
    }
}
