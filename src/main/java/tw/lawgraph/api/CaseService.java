package tw.lawgraph.api;

import com.embabel.agent.core.Agent;
import com.embabel.agent.core.AgentPlatform;
import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.core.Blackboard;
import com.embabel.agent.core.ProcessOptions;
import org.springframework.stereotype.Service;
import tw.lawgraph.agent.AnswersResponse;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.agent.QuestionsAwaitable;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 啟動、查詢與續行 LegalGraphAgent 流程；caseId 即 Embabel processId。 */
@Service
public class CaseService {
    private final AgentPlatform platform;
    private final Map<String, Locale> locales = new ConcurrentHashMap<>();

    /** 注入 Embabel AgentPlatform。 */
    public CaseService(AgentPlatform platform) { this.platform = platform; }

    /** 建立 Agent 流程並非同步啟動。 */
    public CaseStatus start(String text, Locale locale) {
        Agent agent = platform.agents().stream()
                .filter(candidate -> LegalGraphAgent.AGENT_NAME.equals(candidate.getName()))
                .findFirst().orElseThrow(() -> new IllegalStateException("LegalGraphAgent not deployed"));
        AgentProcess process = platform.createAgentProcessFrom(agent, new ProcessOptions(), new CaseInput(text, locale));
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
        QuestionsAwaitable awaitable = process.getBlackboard().last(QuestionsAwaitable.class);
        if (awaitable == null) throw new CaseNotWaitingException(caseId);
        awaitable.onResponse(new AnswersResponse(awaitable.getId(), answers), process);
        platform.start(process);
        return status(caseId);
    }

    /** 從 blackboard 擷取各階段產物，等待時附上待答問題。 */
    private StatusSnapshot snapshot(String caseId, AgentProcess process) {
        Blackboard blackboard = process.getBlackboard();
        QuestionsAwaitable awaitable = blackboard.last(QuestionsAwaitable.class);
        List<Question> pending = process.getStatus() == AgentProcessStatusCode.WAITING && awaitable != null
                ? awaitable.questions() : null;
        Object failure = process.getFailureInfo();
        return new StatusSnapshot(caseId, locales.get(caseId), process.getStatus(),
                blackboard.last(BrainstormResult.class), pending, blackboard.last(UserAnswers.class),
                blackboard.last(ResearchResult.class), blackboard.last(AnalysisResult.class),
                blackboard.last(GraphOutcome.class), failure == null ? null : failure.toString());
    }
}
