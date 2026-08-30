package tw.lawgraph.agent;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.ElementFinding;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphEdge;
import tw.lawgraph.domain.GraphNode;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Met;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 以假 context 驗證技能 prompt、人工提問捷徑與建圖硬規則。 */
class LegalGraphAgentTest {
    private final Skills skills = new Skills("law-powers", "test skills");
    private final LegalGraphAgent agent = new LegalGraphAgent(skills);
    private final CaseInput input = new CaseInput("A rear-ended B.", Locale.ZH_TW);
    private final BrainstormResult brainstorm = new BrainstormResult(
            List.of("f"), List.of(), List.of("i"), List.of(), List.of());
    private final ResearchResult research = new ResearchResult(
            List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "", "")), List.of(), List.of());
    private final AnalysisResult analysis = new AnalysisResult(
            List.of(new ElementFinding("民法第184條第1項", "相當因果關係", Met.unknown, "", "")),
            "", List.of(), "");

    /** 頭腦風暴 Action 必須傳入技能啟用 prompt。 */
    @Test
    void brainstormUsesSkillActivationAndLocale() {
        var context = FakeOperationContext.create();
        context.expectResponse(brainstorm);
        var output = agent.brainstorm(input, context);
        assertEquals(brainstorm, output);
        var invocation = context.getLlmInvocations().getFirst();
        assertTrue(invocation.getPrompt().startsWith("Activate skill \"legal-brainstorming\""));
    }

    /** 無澄清問題時不得建立等待物件。 */
    @Test
    void askUserReturnsEmptyAnswersWhenNoQuestions() {
        assertEquals(new UserAnswers(List.of()), agent.askUser(brainstorm));
    }

    /** 建圖 Action 回傳前必須剔除虛構法條並覆寫 met。 */
    @Test
    void buildGraphAppliesHardRules() {
        var context = FakeOperationContext.create();
        context.expectResponse(new GraphData(List.of(
                new GraphNode("l1", "law", "Civil Code Art. 184 ¶1（民法第184條第1項）", null,
                        "民法第184條第1項", null, null, null, null, null, null, null, null, null),
                new GraphNode("l2", "law", "made up", null, "民法第1條", null,
                        null, null, null, null, null, null, null, null),
                new GraphNode("e1", "element", "相當因果關係", null, null, null,
                        "yes", null, null, null, null, null, null, null)),
                List.of(new GraphEdge("l1", "e1", "要件", null, null),
                        new GraphEdge("l2", "e1", "要件", null, null))));
        var output = agent.buildGraph(input, brainstorm, research, analysis, context);
        assertEquals(2, output.graph().nodes().size());
        assertEquals("unknown", output.graph().nodes().get(1).met());
        assertEquals(1, output.graph().edges().size());
        assertEquals(1, output.notes().stream()
                .filter(note -> note.startsWith("removed unverified law")).count());
    }
}
