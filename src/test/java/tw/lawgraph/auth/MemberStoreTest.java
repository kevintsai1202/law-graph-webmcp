package tw.lawgraph.auth;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/** 對 InMemoryMemberStore 與 JdbcMemberStore 兩種實作跑同一組參數化測試，確保會員 upsert／刪除／統計行為一致。 */
class MemberStoreTest {
    /** 台北時區：countActiveOn 以此判定「當日」。 */
    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");

    /** 兩種實作；Jdbc 版每次以獨立的 H2 記憶體資料庫避免互相污染。 */
    static Stream<MemberStore> stores() {
        return Stream.of(new InMemoryMemberStore(),
                new JdbcMemberStore(new DriverManagerDataSource(
                        "jdbc:h2:mem:member" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "")));
    }

    /** 台北時間 2026-09-05 10:00。 */
    private static final Instant T1 = Instant.parse("2026-09-05T02:00:00Z");
    /** 台北時間 2026-09-06 10:00。 */
    private static final Instant T2 = Instant.parse("2026-09-06T02:00:00Z");

    /** 第一次登入為新建，第二次為更新：登入次數累加、首次登入時間不變、姓名與頭像刷新。 */
    @ParameterizedTest
    @MethodSource("stores")
    void recordLoginCreatesThenUpdates(MemberStore store) {
        var first = store.recordLogin("s1", "a@example.com", "Kevin", "https://img/a.png", T1);
        assertTrue(first.created());
        assertEquals(1, first.member().loginCount());
        assertEquals(T1, first.member().firstLoginAt());

        var second = store.recordLogin("s1", "a@example.com", "Kevin Tsai", "https://img/b.png", T2);
        assertFalse(second.created());
        assertEquals(2, second.member().loginCount());
        assertEquals(T1, second.member().firstLoginAt());
        assertEquals(T2, second.member().lastLoginAt());
        assertEquals("Kevin Tsai", second.member().displayName());
        assertEquals("https://img/b.png", second.member().pictureUrl());
        assertEquals(1, store.count());
    }

    /** 首登告知確認前 noticeAcknowledgedAt 為 null，確認後有時間戳。 */
    @ParameterizedTest
    @MethodSource("stores")
    void acknowledgeNoticeStampsTime(MemberStore store) {
        store.recordLogin("s1", "a@example.com", "A", null, T1);
        assertNull(store.find("s1").orElseThrow().noticeAcknowledgedAt());
        store.acknowledgeNotice("s1", T2);
        assertEquals(T2, store.find("s1").orElseThrow().noticeAcknowledgedAt());
    }

    /** 封鎖後 blocked 為 true 並保留原因。 */
    @ParameterizedTest
    @MethodSource("stores")
    void blockMarksMember(MemberStore store) {
        store.recordLogin("s1", "x@excluded.com", "X", null, T1);
        assertFalse(store.find("s1").orElseThrow().blocked());
        store.block("s1", "LICENSE_EXCLUDED");
        var member = store.find("s1").orElseThrow();
        assertTrue(member.blocked());
        assertEquals("LICENSE_EXCLUDED", member.blockedReason());
    }

    /** delete 刪除存在的會員回 true，重複刪除回 false，find 之後為空。 */
    @ParameterizedTest
    @MethodSource("stores")
    void deleteRemovesMember(MemberStore store) {
        store.recordLogin("s1", "a@example.com", "A", null, T1);
        assertTrue(store.delete("s1"));
        assertTrue(store.find("s1").isEmpty());
        assertFalse(store.delete("s1"));
        assertEquals(0, store.count());
    }

    /** 保存期限：只刪最後登入早於 cutoff 的會員，且 inactiveSubs 先列出同一批。 */
    @ParameterizedTest
    @MethodSource("stores")
    void deleteInactiveBeforeOnlyRemovesStale(MemberStore store) {
        store.recordLogin("old", "old@example.com", "Old", null, T1);
        store.recordLogin("new", "new@example.com", "New", null, T2);
        Instant cutoff = Instant.parse("2026-09-05T12:00:00Z");
        assertEquals(java.util.List.of("old"), store.inactiveSubs(cutoff));
        assertEquals(1, store.deleteInactiveBefore(cutoff));
        assertTrue(store.find("old").isEmpty());
        assertTrue(store.find("new").isPresent());
        assertEquals(java.util.List.of(), store.inactiveSubs(cutoff));
    }

    /** countActiveOn 以台北日曆日判定最後登入落點。 */
    @ParameterizedTest
    @MethodSource("stores")
    void countActiveOnUsesTaipeiDay(MemberStore store) {
        store.recordLogin("s1", "a@example.com", "A", null, T1);
        store.recordLogin("s2", "b@example.com", "B", null, T2);
        assertEquals(2, store.count());
        assertEquals(1, store.countActiveOn(LocalDate.ofInstant(T1, TAIPEI)));
        assertEquals(1, store.countActiveOn(LocalDate.ofInstant(T2, TAIPEI)));
        assertEquals(0, store.countActiveOn(LocalDate.of(2026, 1, 1)));
    }

    /** 未知 sub 的操作皆為 no-op，不得丟例外。 */
    @ParameterizedTest
    @MethodSource("stores")
    void unknownSubIsNoop(MemberStore store) {
        store.acknowledgeNotice("nobody", T1);
        store.block("nobody", "X");
        assertTrue(store.find("nobody").isEmpty());
        assertNotNull(store.name());
    }
}
