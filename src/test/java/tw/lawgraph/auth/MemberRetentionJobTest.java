package tw.lawgraph.auth;

import org.junit.jupiter.api.Test;
import tw.lawgraph.usage.UsageEventStore;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 個資保存期限排程：超過保存天數未登入的會員先去識別化事件，再刪除會員資料。 */
class MemberRetentionJobTest {
    /** 固定「現在」為台北時間 2026-09-05 10:00。 */
    private static final Instant NOW = Instant.parse("2026-09-05T02:00:00Z");

    /** 一新一舊兩位會員：只有舊的被刪除，且其事件先被匿名化。 */
    @Test void deletesOnlyStaleMembersAndAnonymizesTheirEvents() {
        var store = new InMemoryMemberStore();
        store.recordLogin("old", "old@example.com", "Old", null, NOW.minusSeconds(400L * 86400));
        store.recordLogin("fresh", "fresh@example.com", "Fresh", null, NOW.minusSeconds(10L * 86400));
        UsageEventStore events = mock(UsageEventStore.class);

        int deleted = new MemberRetentionJob(store, events, 365, Clock.fixed(NOW, ZoneOffset.UTC)).run();

        assertEquals(1, deleted);
        assertTrue(store.find("old").isEmpty());
        assertTrue(store.find("fresh").isPresent());
        // 去識別化以雜湊 key 呼叫，不得傳入 sub 原文
        verify(events).anonymize(tw.lawgraph.usage.IdentityHash.of("user:old"));
        verify(events, never()).anonymize(tw.lawgraph.usage.IdentityHash.of("user:fresh"));
        verify(events, never()).anonymize("old");
    }

    /** 沒有逾期會員時不做任何事。 */
    @Test void noStaleMembersDoesNothing() {
        var store = new InMemoryMemberStore();
        store.recordLogin("fresh", "f@example.com", "F", null, NOW);
        UsageEventStore events = mock(UsageEventStore.class);
        assertEquals(0, new MemberRetentionJob(store, events, 365, Clock.fixed(NOW, ZoneOffset.UTC)).run());
        verifyNoInteractions(events);
        assertEquals(1, store.count());
    }
}
