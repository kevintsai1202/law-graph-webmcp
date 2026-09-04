package tw.lawgraph.agent;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.ClarificationAssessment;
import tw.lawgraph.domain.ClarifiedAnswers;
import tw.lawgraph.domain.DraftedDocument;
import tw.lawgraph.domain.DraftedDocuments;
import tw.lawgraph.domain.ElementFinding;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphEdge;
import tw.lawgraph.domain.GraphNode;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Met;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.SecondRoundAnswers;
import tw.lawgraph.domain.SecondRoundQuestions;
import tw.lawgraph.domain.ThirdRoundAnswers;
import tw.lawgraph.domain.ThirdRoundQuestions;
import tw.lawgraph.domain.UserAnswers;
import tw.lawgraph.research.DualMcpResearchService;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.SemanticQuery;
import tw.lawgraph.research.mcp.McpTwLegalRagAdapter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    /** 模型省略 questions 欄位（反序列化為 null）時不得 NPE，應視為無問題直接繼續（2026-09-04 線上 gallant_keller 卡在 QUESTIONS）。 */
    @Test
    void askUserTreatsNullQuestionsAsNone() {
        var withoutQuestions = new BrainstormResult(List.of("f"), null, null, null, null);
        assertEquals(List.of(), withoutQuestions.questions());
        assertEquals(List.of(), withoutQuestions.issues());
        assertEquals(new UserAnswers(List.of()), agent.askUser(withoutQuestions));
    }

    /** planResearch 只呼叫 LLM 產生查詢意圖，不把 MCP 回應混進計畫。 */
    @Test
    void planResearchProducesResearchPlan() {
        var context = FakeOperationContext.create();
        var plan = new ResearchPlan(List.of("民法第184條"), List.of(
                new ResearchPlan.JudgmentKeywordQuery("車禍 損害賠償", "民事", "", "", "", 10)), "車禍案情");
        context.expectResponse(plan);

        assertEquals(plan, agent.planResearch(input, brainstorm, new ClarifiedAnswers(List.of(), List.of()), context));
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().contains("ResearchPlan"));
    }

    /** 第一輪資料已足夠時，後兩輪都直接略過且不額外呼叫 LLM。 */
    @Test
    void sufficientInitialFactsSkipFollowUpRounds() {
        var context = FakeOperationContext.create();
        var second = agent.assessSecondRound(input, brainstorm, new UserAnswers(List.of()), context);
        assertTrue(second.questions().isEmpty());
        assertEquals(new SecondRoundAnswers(List.of()), agent.askSecondRound(second));
        var third = agent.assessThirdRound(input, brainstorm, new UserAnswers(List.of()), second,
                new SecondRoundAnswers(List.of()), context);
        assertTrue(third.questions().isEmpty());
        assertEquals(new ThirdRoundAnswers(List.of()), agent.askThirdRound(third));
        assertTrue(context.getLlmInvocations().isEmpty());
    }

    /** 第一輪回答仍不足時，第二輪評估只產生新的關鍵問題。 */
    @Test
    void incompleteFirstAnswersProduceSecondRoundQuestions() {
        var context = FakeOperationContext.create();
        var initial = new BrainstormResult(List.of("f"), List.of(), List.of("i"), List.of(),
                List.of(new tw.lawgraph.domain.Question("q1", "何時通知？", "期限")));
        var assessment = new ClarificationAssessment(false,
                List.of(new tw.lawgraph.domain.Question("r2q1", "通知如何送達？", "證明送達")), List.of());
        context.expectResponse(assessment);
        var result = agent.assessSecondRound(input, initial,
                new UserAnswers(List.of(new tw.lawgraph.domain.Answer("q1", "2026-09-01"))), context);
        assertEquals("r2q1", result.questions().getFirst().id());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().contains("round 2 of 3"));
    }

    /** 第三輪後合併全部答案並把仍待確認問題降級為證據缺口，不再等待第四輪。 */
    @Test
    void finalizesAfterThirdRoundWithEvidenceGap() {
        var result = agent.finalizeClarification(
                new UserAnswers(List.of(new tw.lawgraph.domain.Answer("q1", "第一輪"))),
                new SecondRoundAnswers(List.of(new tw.lawgraph.domain.Answer("r2q1", "第二輪"))),
                new ThirdRoundQuestions(List.of(new tw.lawgraph.domain.Question("r3q1", "最後問題", "關鍵")),
                        List.of("證物無法取得")),
                new ThirdRoundAnswers(List.of(new tw.lawgraph.domain.Answer("r3q1", "不知道"))));
        assertEquals(3, result.answers().size());
        assertTrue(result.evidenceGaps().contains("證物無法取得"));
        assertTrue(result.evidenceGaps().stream().anyMatch(value -> value.contains("第三輪後")));
    }

    /** research Action 直接委派 merged service，並以 SemanticQuery 取代計畫中的語意案情文字。 */
    @Test
    void researchDelegatesToDualServiceWithSemanticQuery() {
        var service = mock(DualMcpResearchService.class);
        var plan = new ResearchPlan(List.of("民法第184條"), List.of(), "很長的原始案情");
        var expectedPlan = plan.withSemanticCaseText("摘要後案情");
        when(service.research(expectedPlan)).thenReturn(research);
        var wiredAgent = new LegalGraphAgent(skills, service);

        assertEquals(research, wiredAgent.research(plan, new SemanticQuery("摘要後案情")));
        verify(service).research(expectedPlan);
    }

    /** 語意案情未超過 provider 上限時，prepare Action 原文照用且完全不呼叫 LLM。 */
    @Test
    void keepsSemanticQueryWhenWithinLimit() {
        var plan = new ResearchPlan(List.of(), List.of(), "車禍案情");
        var context = FakeOperationContext.create();

        assertEquals(false, LegalGraphAgent.semanticQueryTooLong(plan));
        assertEquals(new SemanticQuery("車禍案情"), agent.prepareSemanticQuery(plan, context));
        assertTrue(context.getLlmInvocations().isEmpty(), "未超長不得呼叫 LLM");
    }

    /** 超過 500 字時同一個 Action 才呼叫 LLM 摘要，且結果一律不超過上限。 */
    @Test
    void condensesSemanticQueryOnlyWhenTooLong() {
        var longText = "被告提供帳戶予詐欺集團成員使用，被害人匯款後遭提領一空。".repeat(30);
        var plan = new ResearchPlan(List.of(), List.of(), longText);
        var context = FakeOperationContext.create();
        context.expectResponse(new SemanticQuery("幫助詐欺與洗錢：提供帳戶、被害人匯款遭提領。".repeat(20)));

        assertTrue(LegalGraphAgent.semanticQueryTooLong(plan));
        var query = agent.prepareSemanticQuery(plan, context);
        assertEquals(1, context.getLlmInvocations().size(), "超長時恰好呼叫一次 LLM");

        assertTrue(query.text().length() <= McpTwLegalRagAdapter.MAX_QUERY_CHARS, "摘要仍超長時必須再截斷");
        assertTrue(query.text().startsWith("幫助詐欺與洗錢"));
        var prompt = context.getLlmInvocations().getFirst().getPrompt();
        assertTrue(prompt.contains("SemanticQuery"));
        assertTrue(prompt.contains(longText.substring(0, 20)), "prompt 需帶入原始案情");
    }

    /** 抗辯評估 Action 走技能 prompt、輸出經用語守門；模型漏欄位時兜底為空清單。 */
    @Test
    void assessCaseUsesSkillPromptAndSanitizes() {
        var context = FakeOperationContext.create();
        var raw = new tw.lawgraph.domain.CaseAssessment(
                List.of(new tw.lawgraph.domain.DefenseAssessment("i", "合同無效", "合同有效", tw.lawgraph.domain.Risk.low)),
                null, null, null);
        context.expectResponse(raw);
        var answers = new ClarifiedAnswers(List.of(), List.of());
        var output = agent.assessCase(input, brainstorm, research, analysis, answers, context);
        assertEquals("契約無效", output.defenses().getFirst().defense());
        assertEquals(List.of(), output.evidencePlan());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().startsWith("Activate skill \"legal-element-analysis\""));
    }

    /** 未勾選任何書狀時直接回空清單，不得呼叫 LLM。 */
    @Test
    void draftDocumentsSkipsLlmWhenNothingSelected() {
        var context = FakeOperationContext.create();
        var output = agent.draftDocuments(input, brainstorm, research, analysis,
                new tw.lawgraph.domain.CaseAssessment(List.of(), List.of(), List.of(), ""), context);
        assertEquals(new DraftedDocuments(List.of()), output);
        assertTrue(context.getLlmInvocations().isEmpty());
    }

    /** 勾選書狀時以起草 prompt 呼叫 LLM 並回傳結構化書狀。 */
    @Test
    void draftDocumentsUsesDraftPromptForSelectedTypes() {
        var docInput = new CaseInput("A rear-ended B.", Locale.ZH_TW, List.of("complaint"));
        var context = FakeOperationContext.create();
        var docs = new DraftedDocuments(List.of(new DraftedDocument("complaint", "民事起訴狀", "臺灣臺北地方法院",
                List.of(new DraftedDocument.Party("原告", "甲")), List.of("一、緣被告駕車..."), List.of("證一"), "")));
        context.expectResponse(docs);
        assertEquals(docs, agent.draftDocuments(docInput, brainstorm, research, analysis,
                new tw.lawgraph.domain.CaseAssessment(List.of(), List.of(), List.of(), ""), context));
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().contains("起訴狀"));
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
        var output = agent.buildGraph(input, brainstorm, research, analysis,
                new DraftedDocuments(List.of()), context);
        assertEquals(2, output.graph().nodes().size());
        assertEquals("unknown", output.graph().nodes().get(1).met());
        assertEquals(1, output.graph().edges().size());
        assertEquals(1, output.notes().stream()
                .filter(note -> note.startsWith("removed unverified law")).count());
    }
}
