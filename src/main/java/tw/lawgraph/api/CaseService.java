package tw.lawgraph.api;

import com.embabel.agent.core.Agent;
import com.embabel.agent.core.AgentPlatform;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.core.Blackboard;
import com.embabel.agent.core.ProcessOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tw.lawgraph.agent.AnswersResponse;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.agent.QuestionsAwaitable;
import tw.lawgraph.agent.BaseQuestionsAwaitable;
import tw.lawgraph.agent.SecondRoundQuestionsAwaitable;
import tw.lawgraph.agent.ThirdRoundQuestionsAwaitable;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.DraftedDocuments;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 啟動、查詢與續行 LegalGraphAgent 流程；caseId 即 Embabel processId。 */
@Service
public class CaseService {
    /** 看門狗中止案件時回報給前端的錯誤代碼。 */
    static final String STEP_TIMEOUT = "STEP_TIMEOUT";

    private final AgentPlatform platform;
    /** 步驤看門狗：同一步驤超過上限就 kill 流程。 */
    private final StepWatchdog watchdog;
    private final Clock clock;
    private final Map<String, Locale> locales = new ConcurrentHashMap<>();
    /** 已被看門狗中止的案件與其逾時訊息。 */
    private final Map<String, String> timedOut = new ConcurrentHashMap<>();

    /** 相容舊呼叫端與單元測試：預設 300 秒看門狗與系統時鐘。 */
    public CaseService(AgentPlatform platform) {
        this(platform, new StepWatchdog(java.time.Duration.ofSeconds(300)), Clock.systemUTC());
    }

    /** Spring 注入：AgentPlatform 與設定檔建立的看門狗。 */
    @Autowired
    public CaseService(AgentPlatform platform, StepWatchdog watchdog) {
        this(platform, watchdog, Clock.systemUTC());
    }

    /** 完整建構子；Clock 供測試控制時間。 */
    CaseService(AgentPlatform platform, StepWatchdog watchdog, Clock clock) {
        this.platform = platform;
        this.watchdog = watchdog;
        this.clock = clock;
    }

    /**
     * 定期巡檢執行中的案件：同一步驤超過 lawgraph.step-timeout 仍未完成（多半是 LLM 回應逾時後反覆重試）
     * 就 kill 流程並記下訊息，讓狀態查詢回 FAILED／STEP_TIMEOUT，不再執行後續步驤。
     */
    @Scheduled(fixedDelayString = "${lawgraph.step-timeout-sweep:10s}")
    public void sweep() {
        long now = clock.millis();
        for (String caseId : locales.keySet()) {
            AgentProcess process = platform.getAgentProcess(caseId);
            if (process == null || timedOut.containsKey(caseId)) continue;
            if (process.getStatus() != AgentProcessStatusCode.RUNNING) {
                watchdog.forget(caseId);
                continue;
            }
            String step = StatusMapper.deriveStep(snapshot(caseId, process));
            if (watchdog.exceeded(caseId, step, now)) {
                timedOut.put(caseId, timeoutMessage(locales.get(caseId), step));
                process.kill();
            }
        }
    }

    /** 依語系產生逾時訊息，直接顯示在前端失敗頁。 */
    private String timeoutMessage(Locale locale, String step) {
        long seconds = watchdog.limit().toSeconds();
        return locale == Locale.ZH_TW
                ? "「" + step + "」步驤執行超過 " + seconds + " 秒仍未完成（LLM 回應逾時），已中止後續動作，請重新送出案件。"
                : "Step " + step + " did not finish within " + seconds + "s (LLM timeout); the case was aborted. Please submit it again.";
    }

    /** 相容舊呼叫端：無聲請事項。 */
    public CaseStatus start(String text, Locale locale, List<String> documents) {
        return start(text, locale, documents, "");
    }

    /** 相容舊呼叫端：無模型覆寫。 */
    public CaseStatus start(String text, Locale locale, List<String> documents, String motionRequest) {
        return start(text, locale, documents, motionRequest, "");
    }

    /**
     * 建立 Agent 流程並非同步啟動；documents 為勾選的書狀代碼（可為空），motionRequest 為聲請狀的聲請事項，
     * model 為 API 層已過濾的測試模型覆寫（空白用預設）。
     */
    public CaseStatus start(String text, Locale locale, List<String> documents, String motionRequest, String model) {
        Agent agent = platform.agents().stream()
                .filter(candidate -> LegalGraphAgent.AGENT_NAME.equals(candidate.getName()))
                .findFirst().orElseThrow(() -> new IllegalStateException("LegalGraphAgent not deployed"));
        AgentProcess process = platform.createAgentProcessFrom(agent, new ProcessOptions(),
                new CaseInput(text, locale, documents, motionRequest, model));
        locales.put(process.getId(), locale);
        platform.start(process);
        return status(process.getId());
    }

    /** 讀取案件目前狀態。 */
    public CaseStatus status(String caseId) {
        AgentProcess process = platform.getAgentProcess(caseId);
        if (process == null || !locales.containsKey(caseId)) throw new CaseNotFoundException(caseId);
        return StatusMapper.map(snapshot(caseId, process));
    }

    /** 將人類答案交給等待物件並恢復流程。 */
    public CaseStatus answer(String caseId, List<Answer> answers) {
        AgentProcess process = platform.getAgentProcess(caseId);
        if (process == null || !locales.containsKey(caseId)) throw new CaseNotFoundException(caseId);
        if (process.getStatus() != AgentProcessStatusCode.WAITING) throw new CaseNotWaitingException(caseId);
        BaseQuestionsAwaitable<?> awaitable = pendingAwaitable(process.getBlackboard());
        if (awaitable == null) throw new CaseNotWaitingException(caseId);
        awaitable.onResponse(new AnswersResponse(awaitable.getId(), answers), process);
        platform.start(process);
        return status(caseId);
    }

    /** 從 blackboard 擷取各階段產物，等待時附上待答問題。 */
    private StatusSnapshot snapshot(String caseId, AgentProcess process) {
        Blackboard blackboard = process.getBlackboard();
        BaseQuestionsAwaitable<?> awaitable = pendingAwaitable(blackboard);
        List<Question> pending = process.getStatus() == AgentProcessStatusCode.WAITING && awaitable != null
                ? awaitable.questions() : null;
        Object failure = process.getFailureInfo();
        String timeout = timedOut.get(caseId);
        return new StatusSnapshot(caseId, locales.get(caseId), process.getStatus(),
                blackboard.last(BrainstormResult.class), pending, blackboard.last(UserAnswers.class),
                blackboard.last(ResearchResult.class), blackboard.last(AnalysisResult.class),
                blackboard.last(CaseAssessment.class),
                blackboard.last(DraftedDocuments.class),
                blackboard.last(GraphOutcome.class),
                timeout != null ? timeout : failure == null ? null : failure.toString(),
                timeout != null ? STEP_TIMEOUT : null);
    }

    /** 依輪次由後往前取得目前等待物件；不同型別確保每輪答案能驅動下一個 GOAP Action。 */
    private static BaseQuestionsAwaitable<?> pendingAwaitable(Blackboard blackboard) {
        BaseQuestionsAwaitable<?> third = blackboard.last(ThirdRoundQuestionsAwaitable.class);
        if (third != null) return third;
        BaseQuestionsAwaitable<?> second = blackboard.last(SecondRoundQuestionsAwaitable.class);
        return second != null ? second : blackboard.last(QuestionsAwaitable.class);
    }
}
