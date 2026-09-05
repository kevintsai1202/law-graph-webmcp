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
import tw.lawgraph.agent.ContractReviewAgent;
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
import tw.lawgraph.domain.ClauseFindings;
import tw.lawgraph.domain.ComplianceReport;
import tw.lawgraph.domain.ContractBrainstorm;
import tw.lawgraph.domain.ContractInput;
import tw.lawgraph.domain.DraftedDocuments;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.RevisedClauses;
import tw.lawgraph.domain.UserAnswers;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 啟動、查詢與續行 LegalGraphAgent 流程；caseId 即 Embabel processId。 */
@Service
public class CaseService {
    private static final org.slf4j.Logger LOGGER = org.slf4j.LoggerFactory.getLogger(CaseService.class);

    /** 看門狗中止案件時回報給前端的錯誤代碼。 */
    static final String STEP_TIMEOUT = "STEP_TIMEOUT";

    private final AgentPlatform platform;
    /** 步驤看門狗：同一步驤超過上限就 kill 流程。 */
    private final StepWatchdog watchdog;
    private final Clock clock;
    private final Map<String, Locale> locales = new ConcurrentHashMap<>();
    /** 已被看門狗中止的案件與其逾時訊息。 */
    private final Map<String, String> timedOut = new ConcurrentHashMap<>();
    /** caseId → 啟動時的流程模式（case／contract）。 */
    private final Map<String, String> modes = new ConcurrentHashMap<>();
    /** case_event 事件儲存：案件結束時回寫終態。 */
    private final tw.lawgraph.usage.UsageEventStore events;
    /** 已回寫過終態的案件，確保每個案件只寫一次。 */
    private final java.util.Set<String> finished = ConcurrentHashMap.newKeySet();

    /** 相容舊呼叫端與單元測試：預設 300 秒看門狗、系統時鐘與記憶體事件儲存。 */
    public CaseService(AgentPlatform platform) {
        this(platform, new StepWatchdog(java.time.Duration.ofSeconds(300)));
    }

    /** 相容舊呼叫端與單元測試：記憶體事件儲存。 */
    public CaseService(AgentPlatform platform, StepWatchdog watchdog) {
        this(platform, watchdog, new tw.lawgraph.usage.InMemoryUsageEventStore());
    }

    /** Spring 注入：AgentPlatform、設定檔建立的看門狗與 case_event 事件儲存。 */
    @Autowired
    public CaseService(AgentPlatform platform, StepWatchdog watchdog, tw.lawgraph.usage.UsageEventStore events) {
        this(platform, watchdog, Clock.systemUTC(), events);
    }

    /** 供測試控制時間的建構子。 */
    CaseService(AgentPlatform platform, StepWatchdog watchdog, Clock clock) {
        this(platform, watchdog, clock, new tw.lawgraph.usage.InMemoryUsageEventStore());
    }

    /** 完整建構子；Clock 供測試控制時間，events 供統計回寫。 */
    CaseService(AgentPlatform platform, StepWatchdog watchdog, Clock clock, tw.lawgraph.usage.UsageEventStore events) {
        this.platform = platform;
        this.watchdog = watchdog;
        this.clock = clock;
        this.events = events;
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
                recordFinish(caseId, "FAILED");
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
        return start(text, locale, documents, motionRequest, CaseStartContext.anonymous(model));
    }

    /** 啟動案件流程並帶入統計脈絡（身分與模型），供 case_event 記錄。 */
    public CaseStatus start(String text, Locale locale, List<String> documents, String motionRequest, CaseStartContext context) {
        return launch(LegalGraphAgent.AGENT_NAME, CaseMode.CASE, locale,
                new CaseInput(text, locale, documents, motionRequest, context.model()), context);
    }

    /** 相容舊呼叫端：無統計脈絡的合約審查。 */
    public CaseStatus startContract(ContractInput input) {
        return startContract(input, CaseStartContext.anonymous(input.model()));
    }

    /** 啟動合約審查流程（ContractReviewAgent）並帶入統計脈絡。 */
    public CaseStatus startContract(ContractInput input, CaseStartContext context) {
        return launch(ContractReviewAgent.AGENT_NAME, CaseMode.CONTRACT, input.locale(), input, context);
    }

    /**
     * 依 agent 名稱建立流程並啟動；記住語系與模式。
     * case_event 的啟動列必須在 platform.start 之前寫入：流程一旦開跑，token 統計與終態回寫都可能立刻發生，
     * 晚寫會讓那些更新找不到列（token 遺失、快速失敗的案件永遠停在 RUNNING）。
     */
    private CaseStatus launch(String agentName, String mode, Locale locale, Object input, CaseStartContext context) {
        Agent agent = platform.agents().stream().filter(c -> agentName.equals(c.getName()))
                .findFirst().orElseThrow(() -> new IllegalStateException(agentName + " not deployed"));
        AgentProcess process = platform.createAgentProcessFrom(agent, new ProcessOptions(), input);
        locales.put(process.getId(), locale);
        modes.put(process.getId(), mode);
        recordStart(process.getId(), mode, context);
        platform.start(process);
        return status(process.getId());
    }

    /** 寫入案件啟動事件（同時是當日配額計數依據）；統計失敗不得讓已建立的案件無法啟動。 */
    private void recordStart(String caseId, String mode, CaseStartContext context) {
        try {
            events.recordStart(new tw.lawgraph.usage.CaseEvent(caseId,
                    java.time.LocalDate.ofInstant(clock.instant(), DailyCaseQuota.ZONE), mode,
                    context.identityKind(), context.identityHash(),
                    context.model() == null || context.model().isBlank() ? "default" : context.model(),
                    "RUNNING", 0, 0, clock.instant(), null));
        } catch (RuntimeException exception) {
            LOGGER.warn("無法記錄案件啟動事件 caseId={} 錯誤類型={}", caseId, exception.getClass().getSimpleName());
        }
    }

    /** 讀取案件目前狀態。 */
    public CaseStatus status(String caseId) {
        AgentProcess process = platform.getAgentProcess(caseId);
        if (process == null || !locales.containsKey(caseId)) throw new CaseNotFoundException(caseId);
        CaseStatus mapped = StatusMapper.map(snapshot(caseId, process));
        if ("COMPLETED".equals(mapped.status()) || "FAILED".equals(mapped.status())) recordFinish(caseId, mapped.status());
        return mapped;
    }

    /**
     * 首次觀察到終態時把結束狀態與時間回寫 case_event（同一案件只寫一次）；
     * 統計失敗不得影響案件查詢，只記警告。
     */
    private void recordFinish(String caseId, String status) {
        if (!finished.add(caseId)) return;
        try {
            events.recordFinish(caseId, status, clock.instant());
        } catch (RuntimeException exception) {
            LOGGER.warn("無法回寫案件終態 caseId={} 錯誤類型={}", caseId, exception.getClass().getSimpleName());
        }
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
        // 條款分批審查失敗需以錯誤碼形式傳給前端，否則客戶端只看得到一段例外字串
        String failureCode = failureCode(timeout, failure);
        return new StatusSnapshot(caseId, locales.get(caseId), process.getStatus(),
                blackboard.last(BrainstormResult.class), pending, blackboard.last(UserAnswers.class),
                blackboard.last(ResearchResult.class), blackboard.last(AnalysisResult.class),
                blackboard.last(CaseAssessment.class),
                blackboard.last(DraftedDocuments.class),
                blackboard.last(GraphOutcome.class),
                timeout != null ? timeout : failure == null ? null : failure.toString(),
                failureCode,
                modes.getOrDefault(caseId, CaseMode.CASE),
                blackboard.last(ContractBrainstorm.class),
                blackboard.last(ClauseFindings.class),
                blackboard.last(ComplianceReport.class),
                blackboard.last(RevisedClauses.class));
    }

    /** 決定回傳給前端的錯誤碼：逾時優先，其次辨識條款批次審查失敗。 */
    private static String failureCode(String timeout, Object failure) {
        if (timeout != null) return STEP_TIMEOUT;
        if (failure != null && failure.toString().contains(ContractReviewAgent.REVIEW_BATCH_FAILED)) {
            return ContractReviewAgent.REVIEW_BATCH_FAILED;
        }
        return null;
    }

    /** 依輪次由後往前取得目前等待物件；不同型別確保每輪答案能驅動下一個 GOAP Action。 */
    private static BaseQuestionsAwaitable<?> pendingAwaitable(Blackboard blackboard) {
        BaseQuestionsAwaitable<?> third = blackboard.last(ThirdRoundQuestionsAwaitable.class);
        if (third != null) return third;
        BaseQuestionsAwaitable<?> second = blackboard.last(SecondRoundQuestionsAwaitable.class);
        return second != null ? second : blackboard.last(QuestionsAwaitable.class);
    }
}
