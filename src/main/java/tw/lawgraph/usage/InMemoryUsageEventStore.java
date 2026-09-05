package tw.lawgraph.usage;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/** 以記憶體 Map 保存 case_event 事件，語意與 JdbcUsageEventStore 相同，供測試或無資料庫環境使用（重啟即歸零）。 */
public final class InMemoryUsageEventStore implements UsageEventStore {
    /** caseId -> 事件；ConcurrentHashMap 確保多執行緒下讀寫安全。 */
    private final ConcurrentHashMap<String, CaseEvent> events = new ConcurrentHashMap<>();

    /** 若 caseId 已存在則覆蓋（維持冪等，不新增列），否則新增。 */
    @Override
    public void recordStart(CaseEvent event) {
        events.put(event.caseId(), event);
    }

    /** 對存在的 caseId 累加 token；不存在時靜默略過。 */
    @Override
    public void recordTokens(String caseId, long deltaPrompt, long deltaCompletion) {
        events.computeIfPresent(caseId, (id, e) -> new CaseEvent(e.caseId(), e.day(), e.mode(), e.identityKind(),
                e.identityHash(), e.model(), e.status(), e.promptTokens() + deltaPrompt,
                e.completionTokens() + deltaCompletion, e.startedAt(), e.finishedAt()));
    }

    @Override
    public void recordFinish(String caseId, String status, Instant finishedAt) {
        events.computeIfPresent(caseId, (id, e) -> new CaseEvent(e.caseId(), e.day(), e.mode(), e.identityKind(),
                e.identityHash(), e.model(), status, e.promptTokens(), e.completionTokens(), e.startedAt(), finishedAt));
    }

    @Override
    public int countToday(String identityHash, LocalDate day) {
        return (int) events.values().stream()
                .filter(e -> identityHash.equals(e.identityHash()) && day.equals(e.day()))
                .count();
    }

    /** 依日期區間逐日彙總，無資料的日子補 0，依日期升冪排序。 */
    @Override
    public List<DailyStats> dailyStats(LocalDate from, LocalDate to) {
        List<DailyStats> result = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate current = day;
            List<CaseEvent> dayEvents = events.values().stream().filter(e -> current.equals(e.day())).toList();
            long total = dayEvents.size();
            long caseMode = dayEvents.stream().filter(e -> "case".equals(e.mode())).count();
            long contractMode = dayEvents.stream().filter(e -> "contract".equals(e.mode())).count();
            long anonymous = dayEvents.stream().filter(e -> "anonymous".equals(e.identityKind())).count();
            long member = dayEvents.stream().filter(e -> "member".equals(e.identityKind())).count();
            long completed = dayEvents.stream().filter(e -> "COMPLETED".equals(e.status())).count();
            long failed = dayEvents.stream().filter(e -> "FAILED".equals(e.status())).count();
            long promptTokens = dayEvents.stream().mapToLong(CaseEvent::promptTokens).sum();
            long completionTokens = dayEvents.stream().mapToLong(CaseEvent::completionTokens).sum();
            result.add(new DailyStats(current, total, caseMode, contractMode, anonymous, member, completed, failed,
                    promptTokens, completionTokens));
        }
        return result;
    }

    /** 將符合 identityHash 的所有事件之 identityHash 置為 null。 */
    @Override
    public void anonymize(String identityHash) {
        events.replaceAll((id, e) -> identityHash.equals(e.identityHash())
                ? new CaseEvent(e.caseId(), e.day(), e.mode(), e.identityKind(), null, e.model(), e.status(),
                        e.promptTokens(), e.completionTokens(), e.startedAt(), e.finishedAt())
                : e);
    }

    @Override
    public String name() {
        return "memory";
    }
}
