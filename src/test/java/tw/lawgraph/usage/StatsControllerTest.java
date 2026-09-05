package tw.lawgraph.usage;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.api.RateLimiter;
import tw.lawgraph.auth.MemberStore;
import tw.lawgraph.auth.SecurityConfig;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** GET /api/stats：每日次數與 tokens 統計端點的切片測試。 */
@WebMvcTest(controllers = StatsController.class)
@Import({SecurityConfig.class, StatsControllerTest.Limits.class})
class StatsControllerTest {
    /** 這組測試不驗限流，給一個足夠寬鬆的上限。 */
    @org.springframework.boot.test.context.TestConfiguration
    static class Limits {
        @Bean RateLimiter statsRateLimiter() { return new RateLimiter(1000, Clock.systemUTC()); }
    }

    @Autowired MockMvcTester mvc;
    @MockitoBean UsageEventStore events;
    @MockitoBean MemberStore members;

    /** 建立一列每日統計，方便各測試組裝假資料。 */
    private static DailyStats day(LocalDate day, long total) {
        return new DailyStats(day, total, total, 0, total, 0, total, 0, 100, 20);
    }

    /** days=3 時回傳 3 列，且 today 等於最後一列（依日期升冪排序時的最新一天）。 */
    @Test void returnsRequestedDaysAndToday() {
        LocalDate t = LocalDate.now(MemberStore.ZONE);
        List<DailyStats> rows = List.of(day(t.minusDays(2), 1), day(t.minusDays(1), 2), day(t, 3));
        when(events.dailyStats(t.minusDays(2), t)).thenReturn(rows);
        when(events.name()).thenReturn("jdbc");
        when(members.count()).thenReturn(12L);
        when(members.countActiveOn(t)).thenReturn(3L);

        var res = mvc.get().uri("/api/stats?days=3").exchange();
        assertThat(res).hasStatusOk();
        assertThat(res).bodyJson().extractingPath("$.days.length()").isEqualTo(3);
        assertThat(res).bodyJson().extractingPath("$.today.total").isEqualTo(3);
        assertThat(res).bodyJson().extractingPath("$.today.day").isEqualTo(t.toString());
        assertThat(res).bodyJson().extractingPath("$.members.total").isEqualTo(12);
        assertThat(res).bodyJson().extractingPath("$.members.activeToday").isEqualTo(3);
        assertThat(res).bodyJson().extractingPath("$.store").isEqualTo("jdbc");
        assertThat(res).bodyJson().extractingPath("$.days[0].byMode.case").isEqualTo(1);
        assertThat(res).bodyJson().extractingPath("$.days[0].byIdentity.anonymous").isEqualTo(1);
        assertThat(res.getResponse().getHeader("Cache-Control")).contains("max-age=60");
    }

    /** days 超過 90 要被夾住成 90，from 因此為 today-89。 */
    @Test void clampsDaysToNinety() {
        LocalDate t = LocalDate.now(MemberStore.ZONE);
        when(events.dailyStats(any(), any())).thenReturn(List.of());
        when(events.name()).thenReturn("jdbc");

        mvc.get().uri("/api/stats?days=500").exchange();

        verify(events).dailyStats(t.minusDays(89), t);
    }

    /** days=0 要被夾住成 1，from 等於 today。 */
    @Test void clampsDaysToOne() {
        LocalDate t = LocalDate.now(MemberStore.ZONE);
        when(events.dailyStats(any(), any())).thenReturn(List.of());
        when(events.name()).thenReturn("jdbc");

        mvc.get().uri("/api/stats?days=0").exchange();

        verify(events).dailyStats(t, t);
    }

    /** 回應內容不得洩漏身分雜湊或 email 等個資欄位／字串。 */
    @Test void responseNeverLeaksIdentity() throws Exception {
        LocalDate t = LocalDate.now(MemberStore.ZONE);
        when(events.dailyStats(any(), any())).thenReturn(List.of(day(t, 1)));
        when(events.name()).thenReturn("jdbc");

        var res = mvc.get().uri("/api/stats?days=1").exchange();
        String body = res.getMvcResult().getResponse().getContentAsString();
        assertThat(body).doesNotContain("identityHash").doesNotContain("email").doesNotContain("@");
    }

    /** 會員儲存故障不應影響統計本身，只需回報 members 為 -1/-1。 */
    @Test void memberStoreFailureFallsBackButKeepsStats() {
        LocalDate t = LocalDate.now(MemberStore.ZONE);
        when(events.dailyStats(any(), any())).thenReturn(List.of(day(t, 1)));
        when(events.name()).thenReturn("jdbc");
        when(members.count()).thenThrow(new IllegalStateException("db down"));

        var res = mvc.get().uri("/api/stats?days=1").exchange();
        assertThat(res).hasStatusOk();
        assertThat(res).bodyJson().extractingPath("$.members.total").isEqualTo(-1);
        assertThat(res).bodyJson().extractingPath("$.members.activeToday").isEqualTo(-1);
    }
}
