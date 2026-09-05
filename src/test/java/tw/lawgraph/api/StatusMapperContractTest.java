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
        return snap(code, b, q, a, r, f, c, null, null);
    }

    private StatusSnapshot snap(AgentProcessStatusCode code, ContractBrainstorm b, List<Question> q, UserAnswers a,
                                ResearchResult r, ClauseFindings f, ComplianceReport c, GraphOutcome outcome, RevisedClauses revised) {
        return new StatusSnapshot("c1", Locale.ZH_TW, code, null, q, a, r, null, null, null, outcome, null, null,
                CaseMode.CONTRACT, b, f, c, revised);
    }

    @Test void stepsFollowContractPipeline() {
        assertEquals("LOAD", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, null, null, null, null, null, null)));
        assertEquals("QUESTIONS", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, null, null, null, null)));
        assertEquals("RESEARCH", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), null, null, null)));
        assertEquals("REVIEW", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, null, null)));
        assertEquals("SUMMARY", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, findings, null)));
        // 合規報告完成但尚無修訂條款 → REVISE
        assertEquals("REVISE", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, findings, report)));
        // 修訂條款完成 → GRAPH
        assertEquals("GRAPH", StatusMapper.deriveStep(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, findings, report, null, new RevisedClauses(List.of()))));
    }

    @Test void runningWithComplianceOnlyMapsToReviseStep() {
        var status = StatusMapper.map(snap(AgentProcessStatusCode.RUNNING, brainstorm, null, new UserAnswers(List.of()), research, findings, report));
        assertEquals("RUNNING", status.status());
        assertEquals("REVISE", status.step());
    }

    @Test void completedContractRequiresGraph() {
        // 有 compliance 但無 outcome：M2 起視為失敗，避免前端拿到沒有圖的「完成」狀態
        var withoutGraph = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, brainstorm, null, new UserAnswers(List.of()), research, findings, report));
        assertEquals("FAILED", withoutGraph.status());
        assertEquals("COMPLETED_WITHOUT_GRAPH", withoutGraph.error().code());

        // 有 outcome 與 revised：COMPLETED、步驤 GRAPH，result 帶圖與修訂條款
        var outcome = new GraphOutcome(new GraphData(List.of(new GraphNode("c", "contract", "勞動契約", null, null, null, null, null, null, null, null, null, null, null)), List.of()), List.of());
        var revised = new RevisedClauses(List.of());
        var status = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, brainstorm, null, new UserAnswers(List.of()), research, findings, report, outcome, revised));
        assertEquals("COMPLETED", status.status());
        assertEquals(CaseMode.CONTRACT, status.mode());
        assertEquals("GRAPH", status.step());
        assertEquals(report, status.result().compliance());
        assertEquals(brainstorm, status.result().contract());
        assertNotNull(status.result().graph());
        assertEquals(revised, status.result().revised());
    }

    /** COMPLETED 但圖沒有任何節點：等同沒有產物，一律判失敗。 */
    @Test void completedContractWithEmptyGraphIsFailure() {
        var empty = new GraphOutcome(new GraphData(List.of(), List.of()), List.of());
        var status = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, brainstorm, null, new UserAnswers(List.of()), research, findings, report, empty, new RevisedClauses(List.of())));
        assertEquals("FAILED", status.status());
        assertEquals("COMPLETED_WITHOUT_GRAPH", status.error().code());
        assertEquals("graph has no nodes", status.error().message());
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
