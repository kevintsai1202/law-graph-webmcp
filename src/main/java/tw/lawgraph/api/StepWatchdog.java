package tw.lawgraph.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 步驤看門狗：記錄每個案件目前步驤的起始時間，同一步驤持續超過上限即判定逾時。
 * 用來取代「LLM 逾時後無限重試」：逾時就由 CaseService 中止流程並回報錯誤，不再往下跑。
 */
@Component
public class StepWatchdog {
    /** 單一步驤允許的最長時間。 */
    private final Duration limit;
    /** caseId → 目前步驤與其起始毫秒。 */
    private final Map<String, StepClock> clocks = new ConcurrentHashMap<>();

    /** 以設定檔的 lawgraph.step-timeout（預設 300s）建立。 */
    public StepWatchdog(@Value("${lawgraph.step-timeout:300s}") Duration limit) {
        this.limit = limit;
    }

    /** 回報案件目前步驤；同一步驤已持續超過上限時回 true。步驤改變即重新計時。 */
    public boolean exceeded(String caseId, String step, long nowMillis) {
        StepClock clock = clocks.compute(caseId, (id, previous) ->
                previous == null || !previous.step().equals(step) ? new StepClock(step, nowMillis) : previous);
        return nowMillis - clock.since() > limit.toMillis();
    }

    /** 案件不在執行中（等待回答、已結束）時忘記它，下次執行從頭計時。 */
    public void forget(String caseId) {
        clocks.remove(caseId);
    }

    /** 目前的步驤上限。 */
    public Duration limit() {
        return limit;
    }

    /** 某案件某步驤的起始時間。 */
    private record StepClock(String step, long since) {}
}
