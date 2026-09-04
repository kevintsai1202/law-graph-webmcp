package tw.lawgraph.agent;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.api.common.PromptRunner;
import com.embabel.agent.core.hitl.WaitFor;
import com.embabel.agent.skills.Skills;
import org.springframework.beans.factory.annotation.Autowired;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.ClarificationAssessment;
import tw.lawgraph.domain.ClarifiedAnswers;
import tw.lawgraph.domain.DraftedDocuments;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.GraphRules;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.SecondRoundAnswers;
import tw.lawgraph.domain.SecondRoundQuestions;
import tw.lawgraph.domain.TaiwanTerminology;
import tw.lawgraph.domain.ThirdRoundAnswers;
import tw.lawgraph.domain.ThirdRoundQuestions;
import tw.lawgraph.domain.UserAnswers;
import tw.lawgraph.research.DualMcpResearchService;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.SemanticQuery;
import tw.lawgraph.research.mcp.McpTwLegalRagAdapter;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 法律關係圖 Agent：案情、頭腦風暴、人工回答、檢索、涵攝與建圖。
 * 每個 Action 以型別串接，askUser 不呼叫 LLM。
 */
@Agent(name = LegalGraphAgent.AGENT_NAME,
        description = "Turn a Taiwan legal case description into a verified legal relationship graph using law-powers skills")
public class LegalGraphAgent {
    /** AgentPlatform 啟動流程時使用的穩定名稱。 */
    public static final String AGENT_NAME = "LegalGraphAgent";

    private final Skills skills;
    private final DualMcpResearchService researchService;

    /** 相容既有單元測試；未注入 service 時僅可測試不需要研究的 Action。 */
    public LegalGraphAgent(Skills skills) {
        this(skills, null);
    }

    /** 注入技能集合與雙 MCP 研究 service。 */
    @Autowired
    public LegalGraphAgent(Skills skills, DualMcpResearchService researchService) {
        this.skills = skills;
        this.researchService = researchService;
    }

    /**
     * 依案件輸入選擇模型：CaseInput.model 有值（API 層已限制只能是測試用便宜模型）就用它，否則用 Embabel 預設模型。
     * 從 blackboard 取 CaseInput，讓沒有 CaseInput 參數的 Action（如 prepareSemanticQuery）也能一致套用。
     */
    private static PromptRunner llm(OperationContext context) {
        CaseInput input = context.last(CaseInput.class);
        return input != null && input.hasModelOverride() ? context.ai().withLlm(input.model()) : context.ai().withDefaultLlm();
    }

    /** 步驟一：產生事實、法律關係、爭點、證據需求與待問問題。 */
    @Action
    public BrainstormResult brainstorm(CaseInput input, OperationContext context) {
        return llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.brainstorm(input), BrainstormResult.class);
    }

    /** 步驟二：有問題就停在 WAITING 等人回答，沒有問題直接回空答案。 */
    @Action
    public UserAnswers askUser(BrainstormResult brainstorm) {
        if (brainstorm.questions().isEmpty()) {
            return new UserAnswers(List.of());
        }
        return WaitFor.awaitable(new QuestionsAwaitable(brainstorm.questions()));
    }

    /** 第一輪回答後判斷是否需要第二輪；初始資料已足夠時不再呼叫 LLM。 */
    @Action
    public SecondRoundQuestions assessSecondRound(CaseInput input, BrainstormResult brainstorm,
                                                  UserAnswers firstAnswers, OperationContext context) {
        if (brainstorm.questions().isEmpty()) return new SecondRoundQuestions(List.of(), List.of());
        ClarificationAssessment assessment = llm(context).withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.clarify(input, brainstorm, firstAnswers.answers(),
                        brainstorm.questions(), 2), ClarificationAssessment.class);
        return new SecondRoundQuestions(safeQuestions(assessment), safeGaps(assessment));
    }

    /** 第二輪有新問題時停下等待，否則直接回空答案。 */
    @Action
    public SecondRoundAnswers askSecondRound(SecondRoundQuestions round) {
        if (round.questions().isEmpty()) return new SecondRoundAnswers(List.of());
        return WaitFor.awaitable(new SecondRoundQuestionsAwaitable(round.questions()));
    }

    /** 第二輪回答後判斷是否需要最後一輪；前一輪已足夠時直接略過。 */
    @Action
    public ThirdRoundQuestions assessThirdRound(CaseInput input, BrainstormResult brainstorm,
                                                UserAnswers firstAnswers, SecondRoundQuestions secondQuestions,
                                                SecondRoundAnswers secondAnswers, OperationContext context) {
        if (secondQuestions.questions().isEmpty()) {
            return new ThirdRoundQuestions(List.of(), secondQuestions.evidenceGaps());
        }
        List<Object> priorAnswers = List.of(firstAnswers.answers(), secondAnswers.answers());
        List<Object> priorQuestions = List.of(brainstorm.questions(), secondQuestions.questions());
        ClarificationAssessment assessment = llm(context).withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.clarify(input, brainstorm, priorAnswers, priorQuestions, 3),
                        ClarificationAssessment.class);
        List<String> gaps = Stream.concat(secondQuestions.evidenceGaps().stream(), safeGaps(assessment).stream())
                .distinct().toList();
        return new ThirdRoundQuestions(safeQuestions(assessment), gaps);
    }

    /** 第三輪有新問題時做最後一次等待，否則直接回空答案。 */
    @Action
    public ThirdRoundAnswers askThirdRound(ThirdRoundQuestions round) {
        if (round.questions().isEmpty()) return new ThirdRoundAnswers(List.of());
        return WaitFor.awaitable(new ThirdRoundQuestionsAwaitable(round.questions()));
    }

    /** 合併三輪答案；第三輪後不再阻擋研究，剩餘不確定性一律列為證據缺口。 */
    @Action
    public ClarifiedAnswers finalizeClarification(UserAnswers firstAnswers, SecondRoundAnswers secondAnswers,
                                                  ThirdRoundQuestions thirdQuestions, ThirdRoundAnswers thirdAnswers) {
        List<tw.lawgraph.domain.Answer> answers = Stream.of(firstAnswers.answers(), secondAnswers.answers(), thirdAnswers.answers())
                .flatMap(List::stream).toList();
        Map<String, String> finalAnswerByQuestion = thirdAnswers.answers().stream()
                .collect(Collectors.toMap(tw.lawgraph.domain.Answer::questionId,
                        answer -> answer.answer() == null ? "" : answer.answer(), (first, ignored) -> first));
        List<String> gaps = Stream.concat(thirdQuestions.evidenceGaps().stream(),
                        thirdQuestions.questions().stream()
                                .filter(question -> isUnavailable(finalAnswerByQuestion.get(question.id())))
                                .map(question -> question.text() + "（第三輪後仍未能確認）"))
                .distinct().toList();
        return new ClarifiedAnswers(answers, gaps);
    }

    /** 步驟三：由 LLM 只產生雙軌檢索計畫，不在此階段宣稱已找到法源。 */
    @Action
    public ResearchPlan planResearch(CaseInput input, BrainstormResult brainstorm, ClarifiedAnswers answers,
                                     OperationContext context) {
        return llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.research(input, brainstorm, answers), ResearchPlan.class);
    }

    /** 防禦模型回傳 null questions，且 sufficient=true 時強制不再追問。 */
    private static List<tw.lawgraph.domain.Question> safeQuestions(ClarificationAssessment assessment) {
        return assessment == null || assessment.sufficient() || assessment.questions() == null
                ? List.of() : assessment.questions().stream().filter(java.util.Objects::nonNull).limit(5).toList();
    }

    /** 防禦模型回傳 null evidenceGaps。 */
    private static List<String> safeGaps(ClarificationAssessment assessment) {
        return assessment == null || assessment.evidenceGaps() == null
                ? List.of() : assessment.evidenceGaps().stream().filter(value -> value != null && !value.isBlank()).distinct().toList();
    }

    /** 判斷回答是否明確表示未知／無法取得；這類答案是終止資訊而不是下一輪重問理由。 */
    private static boolean isUnavailable(String answer) {
        if (answer == null || answer.isBlank()) return true;
        String value = answer.trim().toLowerCase(java.util.Locale.ROOT);
        return List.of("unknown", "not sure", "unavailable", "不知道", "不清楚", "沒有資料", "無資料", "無法取得")
                .stream().anyMatch(value::contains);
    }

    /** 語意檢索 provider 的 query 上限；超過才需要額外一次 LLM 摘要。 */
    static final int SEMANTIC_QUERY_MAX_CHARS = McpTwLegalRagAdapter.MAX_QUERY_CHARS;

    /** 判斷計畫中的語意案情文字是否超過 provider 上限，需先摘要。 */
    static boolean semanticQueryTooLong(ResearchPlan plan) {
        return plan != null && plan.semanticCaseText().length() > SEMANTIC_QUERY_MAX_CHARS;
    }

    /**
     * 步驟三之二：產生送往語意檢索的最終查詢。
     * 注意：Embabel GOAP 在規劃階段就要能判定每個 Action 的前置條件；依賴 ResearchPlan 內容的 @Condition
     * 在規劃時尚未有資料，會讓整個流程找不到計畫而立即 stuck（2026-09-04 線上實測）。
     * 因此以單一 Action 固定進入計畫圖，在 Action 內部依長度決定：未超過 500 字原文照用、零 LLM 成本；
     * 超過才呼叫一次 LLM 摘要，摘要仍超長時以句尾截斷兜底。
     */
    @Action(description = "Prepare the semantic query: pass through short case text, or condense it once when it exceeds the provider limit")
    public SemanticQuery prepareSemanticQuery(ResearchPlan plan, OperationContext context) {
        if (!semanticQueryTooLong(plan)) return new SemanticQuery(plan.semanticCaseText());
        SemanticQuery condensed = llm(context)
                .createObject(LegalPrompts.condenseSemanticQuery(plan, SEMANTIC_QUERY_MAX_CHARS), SemanticQuery.class);
        String text = condensed == null || condensed.text().isBlank() ? plan.semanticCaseText() : condensed.text();
        return new SemanticQuery(McpTwLegalRagAdapter.truncateQuery(text));
    }

    /** 步驟四：由 Java orchestration 並行呼叫兩個 MCP、合併去重後才產出研究結果；語意軌使用已確認長度的 SemanticQuery。 */
    @Action
    public ResearchResult research(ResearchPlan plan, SemanticQuery semanticQuery) {
        if (researchService == null) throw new IllegalStateException("dual MCP research service is unavailable");
        return researchService.research(plan.withSemanticCaseText(semanticQuery.text()));
    }

    /** 步驟五：只以合併後且通過白名單的研究證據分析法律要件。 */
    @Action
    public AnalysisResult analyze(ResearchResult research, BrainstormResult brainstorm, CaseInput input,
                                  OperationContext context) {
        AnalysisResult analysis = llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.analyze(research, brainstorm, input.locale()), AnalysisResult.class);
        // 台灣用語守門：黑名單詞自動替換並記 WARN
        return TaiwanTerminology.sanitize(analysis);
    }

    /** 步驟五：起草使用者勾選的書狀；未勾選任何書狀時直接回空清單，不呼叫 LLM。 */
    @Action
    public DraftedDocuments draftDocuments(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                           AnalysisResult analysis, OperationContext context) {
        if (input.documents().isEmpty()) {
            return new DraftedDocuments(List.of());
        }
        DraftedDocuments drafted = llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.draftDocuments(input, brainstorm, research, analysis),
                        DraftedDocuments.class);
        // 台灣用語守門：黑名單詞自動替換並記 WARN
        return TaiwanTerminology.sanitize(drafted);
    }

    /** 步驟六：產生 3D 圖資料並套用四條硬規則（documents 參數確保書狀先行起草）。 */
    @AchievesGoal(description = "A verified legal relationship graph for the case")
    @Action
    public GraphOutcome buildGraph(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                   AnalysisResult analysis, DraftedDocuments documents, OperationContext context) {
        GraphData raw = llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.buildGraph(input, brainstorm, research, analysis), GraphData.class);
        return GraphRules.apply(raw, research, analysis);
    }
}
