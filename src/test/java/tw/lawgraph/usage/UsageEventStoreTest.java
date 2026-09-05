package tw.lawgraph.usage;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.*;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/** 對 InMemoryUsageEventStore 與 JdbcUsageEventStore 兩種實作跑同一組參數化測試，確保行為一致。 */
class UsageEventStoreTest {
    static Stream<UsageEventStore> stores() {
        return Stream.of(new InMemoryUsageEventStore(),
                new JdbcUsageEventStore(new DriverManagerDataSource("jdbc:h2:mem:events" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "")));
    }

    private static CaseEvent start(String id, LocalDate day, String mode, String kind, String hash) {
        return new CaseEvent(id, day, mode, kind, hash, "nano", "RUNNING", 0, 0, Instant.parse("2026-09-05T01:00:00Z"), null);
    }

    @ParameterizedTest
    @MethodSource("stores")
    void countsTokensFinishAndDailyStats(UsageEventStore store) {
        var d = LocalDate.of(2026, 9, 5);
        store.recordStart(start("c1", d, "case", "anonymous", "h1"));
        store.recordStart(start("c2", d, "contract", "member", "sub-1"));
        store.recordStart(start("c3", d.minusDays(1), "case", "anonymous", "h1"));
        store.recordTokens("c1", 100, 20);
        store.recordTokens("c1", 50, 5);
        store.recordTokens("missing", 1, 1);
        store.recordFinish("c1", "COMPLETED", Instant.parse("2026-09-05T01:05:00Z"));
        store.recordFinish("c2", "FAILED", Instant.parse("2026-09-05T01:06:00Z"));
        assertEquals(1, store.countToday("h1", d));
        assertEquals(0, store.countToday("nobody", d));
        var stats = store.dailyStats(d.minusDays(2), d);
        assertEquals(3, stats.size());
        assertEquals(0, stats.get(0).total());
        var today = stats.get(2);
        assertEquals(2, today.total());
        assertEquals(1, today.caseMode());
        assertEquals(1, today.contractMode());
        assertEquals(1, today.anonymous());
        assertEquals(1, today.member());
        assertEquals(1, today.completed());
        assertEquals(1, today.failed());
        assertEquals(150, today.promptTokens());
        assertEquals(25, today.completionTokens());
        assertEquals(175, today.totalTokens());
        store.anonymize("sub-1");
        assertEquals(0, store.countToday("sub-1", d));
    }

    @ParameterizedTest
    @MethodSource("stores")
    void startIsIdempotent(UsageEventStore store) {
        var d = LocalDate.of(2026, 9, 5);
        store.recordStart(start("c1", d, "case", "anonymous", "h"));
        store.recordStart(start("c1", d, "case", "anonymous", "h"));
        assertEquals(1, store.countToday("h", d));
    }

    @org.junit.jupiter.api.Test
    void identityHashIsStableSha256() {
        assertEquals(IdentityHash.of("ip:1.2.3.4"), IdentityHash.of("ip:1.2.3.4"));
        assertEquals(64, IdentityHash.of("x").length());
    }
}
