package tw.lawgraph.agent;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import tw.lawgraph.domain.ContractBrainstorm.Clause;
import tw.lawgraph.research.DualMcpResearchService;
import tw.lawgraph.research.ResearchPlan;
import java.util.List;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 合約審查 Agent：技能啟用、分批審查合併、白名單過濾、摘要覆寫整體風險。 */
class ContractReviewAgentTest {
    private final Skills skills = new Skills("law-powers", "test skills");
    private final ContractReviewAgent agent = new ContractReviewAgent(skills, null);
    private final ContractInput input = new ContractInput("第一條 乙方自願放棄加班費。", Locale.ZH_TW, "partyB", List.of("labor"), List.of(), "");
    private final ResearchResult research = new ResearchResult(
            List.of(new LawRef("勞動基準法第24條", "", "", ""), new LawRef("民法第71條", "", "", "")),
            List.of(new JudgmentRef("j1", "最高法院110年度台上字第1號民事判決", "", "", "", "")), List.of());

    private static ContractBrainstorm brainstormWith(int clauseCount) {
        var clauses = IntStream.rangeClosed(1, clauseCount).mapToObj(i -> new Clause("第" + i + "條", "條文" + i)).toList();
        return new ContractBrainstorm("勞動契約", List.of("labor"), List.of(), clauses, List.of(), "摘要");
    }

    @Test void loadContractActivatesComplianceSkill() {
        var context = FakeOperationContext.create();
        var expected = brainstormWith(1);
        context.expectResponse(expected);
        assertEquals(expected, agent.loadContract(input, context));
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().startsWith("Activate skill \"compliance-verification\""));
    }

    @Test void askUserShortCircuitsWithoutQuestions() {
        assertEquals(new UserAnswers(List.of()), agent.askUser(brainstormWith(1)));
    }

    @Test void batchesSplitByFifteen() {
        var batches = ContractReviewAgent.batches(brainstormWith(31).clauses());
        assertEquals(3, batches.size());
        assertEquals(15, batches.get(0).size());
        assertEquals(1, batches.get(2).size());
        assertEquals(List.of(List.of()), ContractReviewAgent.batches(List.of()));
    }

    @Test void reviewClausesCallsLlmOncePerBatchAndMerges() {
        var context = FakeOperationContext.create();
        var brainstorm = brainstormWith(16);
        context.expectResponse(new ClauseFindings(List.of(new ClauseFinding("第1條", "條文1", Risk.high, List.of("勞動基準法第24條", "勞基法第24條（幻覺）"), "違反", "改", List.of("最高法院110年度台上字第1號民事判決", "亂引"))), List.of()));
        context.expectResponse(new ClauseFindings(List.of(new ClauseFinding("第16條", "條文16", Risk.low, List.of(), "", "", List.of())), List.of()));
        var out = agent.reviewClauses(input, brainstorm, research, new ClarifiedAnswers(List.of(), List.of()), context);
        assertEquals(2, context.getLlmInvocations().size());
        assertTrue(context.getLlmInvocations().get(0).getPrompt().contains("batch 1 of 2"));
        assertEquals(2, out.findings().size());
        assertEquals(List.of("勞動基準法第24條"), out.findings().getFirst().lawRefs());
        assertEquals(List.of("最高法院110年度台上字第1號民事判決"), out.findings().getFirst().judgmentCitations());
        assertTrue(out.notes().stream().anyMatch(n -> n.contains("勞基法第24條（幻覺）")));
    }

    @Test void emptyClausesReviewedAsWholeText() {
        var context = FakeOperationContext.create();
        var brainstorm = new ContractBrainstorm("x", List.of(), List.of(), List.of(), List.of(), "");
        context.expectResponse(new ClauseFindings(List.of(new ClauseFinding("全文", input.text(), Risk.medium, List.of(), "", "", List.of())), List.of()));
        var out = agent.reviewClauses(input, brainstorm, research, new ClarifiedAnswers(List.of(), List.of()), context);
        assertEquals(1, context.getLlmInvocations().size());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().contains("\"clauseNo\":\"全文\""));
        assertEquals("全文", out.findings().getFirst().clauseNo());
    }

    @Test void summarizeOverridesOverallRiskAndKeepsFindings() {
        var context = FakeOperationContext.create();
        var findings = new ClauseFindings(List.of(new ClauseFinding("第1條", "", Risk.high, List.of(), "", "", List.of())), List.of());
        context.expectResponse(new ComplianceReport("勞動契約", List.of("labor"), Risk.low, List.of(), List.of("先改第1條"), ""));
        var report = agent.summarizeCompliance(input, brainstormWith(1), findings, context);
        assertEquals(Risk.high, report.overallRisk());
        assertEquals(1, report.findings().size());
        assertEquals(ComplianceReport.DEFAULT_DISCLAIMER, report.disclaimer());
    }

    @Test void researchDelegatesToService() {
        var service = mock(DualMcpResearchService.class);
        var withService = new ContractReviewAgent(skills, service);
        var plan = new ResearchPlan(List.of("民法第71條"), List.of(), "短文");
        when(service.research(plan)).thenReturn(research);
        assertEquals(research, withService.research(plan, new tw.lawgraph.research.SemanticQuery("短文")));
        assertThrows(IllegalStateException.class, () -> agent.research(plan, new tw.lawgraph.research.SemanticQuery("短文")));
    }

    /** 任一批次沒有回應即整案失敗，訊息以 REVIEW_BATCH_FAILED 開頭供 API 轉為錯誤碼。 */
    @Test void reviewBatchFailureThrowsWithErrorCode() {
        var context = FakeOperationContext.create();
        context.expectResponse(null);
        var failure = assertThrows(IllegalStateException.class, () -> agent.reviewClauses(
                input, brainstormWith(1), research, new ClarifiedAnswers(List.of(), List.of()), context));
        assertTrue(failure.getMessage().startsWith(ContractReviewAgent.REVIEW_BATCH_FAILED));
        assertTrue(failure.getMessage().contains("batch 1 of 1"));
    }
}
