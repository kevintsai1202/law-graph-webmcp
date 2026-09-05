package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 合約模式的步驤推導與完成判定。 */
class StatusMapperContractTest {
    private final ContractBrainstorm brainstorm = new ContractBrainstorm("勞動契約", List.of("labor"), List.of(), List.of(), List.of(new Question("q1", "?", "w")), "");
    private final ResearchResult research = new ResearchResult(List.of(), List.of(), List.of());
    private final ClauseFindings findings = new ClauseFindings(List.of(), List.of());
    private final ComplianceReport report = new ComplianceReport("勞動契約", List.of("labor"), Risk.low, List.of(), List.of(), null);

    private StatusSnapshot snap(AgentProcessStatusCode code, ContractBrainstorm b, List<Question> q, UserAnswers a,
                                ResearchResult r, ClauseFindings f, ComplianceReport c) {
        return new StatusSnapshot("c1", Locale.ZH_TW, code, null, q, a, r, null, null, null, null, null, null,
                CaseMode.CONTRACT, b, f, c);
    }

    @Test void stepsFollowContractPipeline() {
        assertEquals("LOAD", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, null, null, null, null, null, null)));
        assertEquals("QUESTIONS", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, null, null, null, null)));
        assertEquals("RESEARCH", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), null, null, null)));
        assertEquals("REVIEW", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, null, null)));
        assertEquals("SUMMARY", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, findings, null)));
    }

    @Test void completedContractExposesComplianceWithoutGraph() {
        var status = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, brainstorm, null, new UserAnswers(List.of()), research, findings, report));
        assertEquals("COMPLETED", status.status());
        assertEquals(CaseMode.CONTRACT, status.mode());
        assertEquals("SUMMARY", status.step());
        assertEquals(report, status.result().compliance());
        assertEquals(brainstorm, status.result().contract());
        assertNull(status.result().graph());
    }

    @Test void completedContractWithoutReportIsFailure() {
        var status = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, brainstorm, null, null, research, findings, null));
        assertEquals("FAILED", status.status());
        assertEquals("COMPLETED_WITHOUT_REPORT", status.error().code());
    }

    @Test void waitingContractExposesQuestionsAndPartialContract() {
        var status = StatusMapper.map(snap(AgentProcessStatusCode.WAITING, brainstorm, brainstorm.questions(), null, null, null, null));
        assertEquals("WAITING", status.status());
        assertEquals(1, status.questions().size());
        assertEquals(brainstorm, status.result().contract());
    }

    @Test void legacyConstructorsDefaultToCaseMode() {
        var legacy = new StatusSnapshot("c1", Locale.EN, AgentProcessStatusCode.RUNNING, null, null, null, null, null, null, null, null, null, null);
        assertEquals(CaseMode.CASE, legacy.mode());
        assertEquals(CaseMode.CASE, new CaseStatus("c", "RUNNING", "BRAINSTORM", "en", null, null, null).mode());
        assertEquals(CaseMode.CASE, CaseMode.normalize("weird"));
        assertEquals(tw.lawgraph.agent.ContractReviewAgent.AGENT_NAME, CaseMode.agentName(CaseMode.CONTRACT));
    }
}
