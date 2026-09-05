package tw.lawgraph.agent;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** ContractReviewAgent 新增 reviseClauses／buildContractGraph 的行為測試（goal 由 summarizeCompliance 搬到 buildContractGraph）。 */
class ContractReviewAgentGraphTest {
    private final ContractReviewAgent agent = new ContractReviewAgent(new Skills("law-powers", "t"), null);
    private final ContractBrainstorm brainstorm = new ContractBrainstorm("勞動契約", List.of("labor"), List.of(), List.of(), List.of(), "");
    private final ResearchResult research = new ResearchResult(List.of(new LawRef("勞動基準法第24條", "", "", "")), List.of(), List.of());
    private final ComplianceReport report = new ComplianceReport("勞動契約", List.of("labor"), Risk.high,
            List.of(new ClauseFinding("第二條", "不發加班費", Risk.high, List.of("勞動基準法第24條"), "r", "s", List.of())), List.of(), null);

    @Test void reviseSkipsLlmWhenNotRequested() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of(), "");
        assertEquals(RevisedClauses.EMPTY, agent.reviseClauses(input, brainstorm, report, context));
        assertTrue(context.getLlmInvocations().isEmpty());
    }

    @Test void reviseCallsLlmWhenRequested() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of("revised"), "");
        var expected = new RevisedClauses(List.of(new RevisedClauses.RevisedClause("第二條", "o", "n", "依勞動基準法第24條")));
        context.expectResponse(expected);
        assertEquals(expected, agent.reviseClauses(input, brainstorm, report, context));
    }

    @Test void buildContractGraphColoursClauses() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of(), "");
        context.expectResponse(new GraphData(List.of(
                new GraphNode("c", "contract", "勞動契約", null, null, null, null, null, null, null, null, null, null, null),
                new GraphNode("cl", "clause", "第二條 加班費", null, null, null, null, null, null, null, null, null, null, null)),
                List.of(new GraphEdge("c", "cl", "包含", null, null))));
        var out = agent.buildContractGraph(input, brainstorm, research, report, RevisedClauses.EMPTY, context);
        assertEquals("high", out.graph().nodes().stream().filter(n -> "clause".equals(n.group())).findFirst().orElseThrow().risk());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().startsWith("Activate skill \"legal-graph\""));
    }
}
