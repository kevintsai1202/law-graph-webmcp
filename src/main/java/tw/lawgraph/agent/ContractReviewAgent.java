package tw.lawgraph.agent;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.api.common.PromptRunner;
import com.embabel.agent.core.hitl.WaitFor;
import com.embabel.agent.skills.Skills;
import org.springframework.beans.factory.annotation.Autowired;
import tw.lawgraph.domain.*;
import tw.lawgraph.domain.ContractBrainstorm.Clause;
import tw.lawgraph.research.DualMcpResearchService;
import tw.lawgraph.research.ResearchPlan;
import tw.lawgraph.research.SemanticQuery;
import tw.lawgraph.research.mcp.McpTwLegalRagAdapter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 合約審查 Agent（law-powers compliance-verification 技能的型別化版本）：
 * 載入契約 → 三輪澄清 → 雙軌檢索 → 逐批條款審查 → 合規摘要。與 LegalGraphAgent 並列、共用基礎設施，分支一律在 Action 內部。
 */
@Agent(name = ContractReviewAgent.AGENT_NAME,
        description = "Audit a Taiwan contract draft or business activity against mandatory statutes and rate each clause's risk")
public class ContractReviewAgent {
    /** CaseService 依此名稱挑選 agent。 */
    public static final String AGENT_NAME = "ContractReviewAgent";
    /** 條款分批審查失敗的錯誤碼；同時用於例外訊息前綴與 API error.code。 */
    public static final String REVIEW_BATCH_FAILED = "REVIEW_BATCH_FAILED";
    /** 逐批審查每批最多條款數，避免單次 prompt 過長。 */
    static final int BATCH_SIZE = 15;

    private final Skills skills;
    private final DualMcpResearchService researchService;

    /** 注入技能集合與雙 MCP 研究 service（測試可傳 null）。 */
    @Autowired
    public ContractReviewAgent(Skills skills, DualMcpResearchService researchService) {
        this.skills = skills;
        this.researchService = researchService;
    }

    /** 依 ContractInput.model 選模型（API 層已限制只能是測試模型），否則用預設。 */
    private static PromptRunner llm(OperationContext context) {
        ContractInput input = context.last(ContractInput.class);
        return input != null && input.hasModelOverride() ? context.ai().withLlm(input.model()) : context.ai().withDefaultLlm();
    }

    /** 步驟 LOAD：契約類型、範疇、條款切分、當事人與待問問題。 */
    @Action
    public ContractBrainstorm loadContract(ContractInput input, OperationContext context) {
        ContractBrainstorm result = llm(context).withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.load(input), ContractBrainstorm.class);
        return result == null ? new ContractBrainstorm(null, null, null, null, null, null) : result;
    }

    /** 步驟 QUESTIONS 第一輪：有問題就停在 WAITING。 */
    @Action
    public UserAnswers askUser(ContractBrainstorm brainstorm) {
        if (brainstorm.questions().isEmpty()) return new UserAnswers(List.of());
        return WaitFor.awaitable(new QuestionsAwaitable(brainstorm.questions()));
    }

    /** 第二輪評估。 */
    @Action
    public SecondRoundQuestions assessSecondRound(ContractInput input, ContractBrainstorm brainstorm, UserAnswers first, OperationContext context) {
        if (brainstorm.questions().isEmpty()) return new SecondRoundQuestions(List.of(), List.of());
        ClarificationAssessment a = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.clarify(input, brainstorm, first.answers(), brainstorm.questions(), 2), ClarificationAssessment.class);
        return new SecondRoundQuestions(ClarificationSupport.safeQuestions(a), ClarificationSupport.safeGaps(a));
    }

    /** 第二輪等待。 */
    @Action
    public SecondRoundAnswers askSecondRound(SecondRoundQuestions round) {
        if (round.questions().isEmpty()) return new SecondRoundAnswers(List.of());
        return WaitFor.awaitable(new SecondRoundQuestionsAwaitable(round.questions()));
    }

    /** 第三輪評估。 */
    @Action
    public ThirdRoundQuestions assessThirdRound(ContractInput input, ContractBrainstorm brainstorm, UserAnswers first,
                                                SecondRoundQuestions secondQuestions, SecondRoundAnswers second, OperationContext context) {
        if (secondQuestions.questions().isEmpty()) return new ThirdRoundQuestions(List.of(), secondQuestions.evidenceGaps());
        ClarificationAssessment a = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.clarify(input, brainstorm, List.of(first.answers(), second.answers()),
                        List.of(brainstorm.questions(), secondQuestions.questions()), 3), ClarificationAssessment.class);
        List<String> gaps = Stream.concat(secondQuestions.evidenceGaps().stream(), ClarificationSupport.safeGaps(a).stream()).distinct().toList();
        return new ThirdRoundQuestions(ClarificationSupport.safeQuestions(a), gaps);
    }

    /** 第三輪等待。 */
    @Action
    public ThirdRoundAnswers askThirdRound(ThirdRoundQuestions round) {
        if (round.questions().isEmpty()) return new ThirdRoundAnswers(List.of());
        return WaitFor.awaitable(new ThirdRoundQuestionsAwaitable(round.questions()));
    }

    /** 合併三輪答案；未答者列為缺口。 */
    @Action
    public ClarifiedAnswers finalizeClarification(UserAnswers first, SecondRoundAnswers second,
                                                  ThirdRoundQuestions thirdQuestions, ThirdRoundAnswers third) {
        List<Answer> answers = Stream.of(first.answers(), second.answers(), third.answers()).flatMap(List::stream).toList();
        Map<String, String> byQuestion = third.answers().stream()
                .collect(Collectors.toMap(Answer::questionId, a -> a.answer() == null ? "" : a.answer(), (x, y) -> x));
        List<String> gaps = Stream.concat(thirdQuestions.evidenceGaps().stream(),
                thirdQuestions.questions().stream().filter(q -> ClarificationSupport.isUnavailable(byQuestion.get(q.id())))
                        .map(q -> q.text() + "（第三輪後仍未能確認）")).distinct().toList();
        return new ClarifiedAnswers(answers, gaps);
    }

    /** 步驟 RESEARCH：只產生檢索計畫。 */
    @Action
    public ResearchPlan planResearch(ContractInput input, ContractBrainstorm brainstorm, ClarifiedAnswers answers, OperationContext context) {
        return llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.research(input, brainstorm, answers), ResearchPlan.class);
    }

    /** 語意查詢長度處理（與 LegalGraphAgent 相同邏輯）。 */
    @Action(description = "Prepare the semantic query for the contract review: pass through or condense once")
    public SemanticQuery prepareSemanticQuery(ResearchPlan plan, OperationContext context) {
        if (!LegalGraphAgent.semanticQueryTooLong(plan)) return new SemanticQuery(plan.semanticCaseText());
        SemanticQuery condensed = llm(context).createObject(
                LegalPrompts.condenseSemanticQuery(plan, LegalGraphAgent.SEMANTIC_QUERY_MAX_CHARS), SemanticQuery.class);
        String text = condensed == null || condensed.text().isBlank() ? plan.semanticCaseText() : condensed.text();
        return new SemanticQuery(McpTwLegalRagAdapter.truncateQuery(text));
    }

    /** 雙 MCP 檢索。 */
    @Action
    public ResearchResult research(ResearchPlan plan, SemanticQuery semanticQuery) {
        if (researchService == null) throw new IllegalStateException("dual MCP research service is unavailable");
        return researchService.research(plan.withSemanticCaseText(semanticQuery.text()));
    }

    /** 把條款切成每批 BATCH_SIZE；空清單回一個空批（由呼叫端改以全文審查）。 */
    static List<List<Clause>> batches(List<Clause> clauses) {
        if (clauses.isEmpty()) return List.of(List.of());
        List<List<Clause>> out = new ArrayList<>();
        for (int i = 0; i < clauses.size(); i += BATCH_SIZE) out.add(clauses.subList(i, Math.min(i + BATCH_SIZE, clauses.size())));
        return out;
    }

    /** 引用白名單過濾：不在 research 內的法條／判決引用移除並記 note。 */
    static ClauseFindings filterCitations(ClauseFindings findings, ResearchResult research) {
        Set<String> laws = research.laws().stream().map(LawRef::ref).collect(Collectors.toSet());
        Set<String> judgments = research.judgments().stream().map(JudgmentRef::citation).collect(Collectors.toSet());
        List<String> notes = new ArrayList<>(findings.notes());
        List<ClauseFinding> kept = findings.findings().stream().map(f -> {
            List<String> okLaws = f.lawRefs().stream().filter(laws::contains).toList();
            List<String> okJudgments = f.judgmentCitations().stream().filter(judgments::contains).toList();
            f.lawRefs().stream().filter(r -> !laws.contains(r)).forEach(r -> notes.add("removed unverified law citation in " + f.clauseNo() + ": " + r));
            f.judgmentCitations().stream().filter(c -> !judgments.contains(c)).forEach(c -> notes.add("removed unverified judgment citation in " + f.clauseNo() + ": " + c));
            return f.withRefs(okLaws, okJudgments);
        }).toList();
        return new ClauseFindings(kept, notes);
    }

    /**
     * 步驟 REVIEW：逐批呼叫 LLM 審查條款並合併；沒有條款時以全文為單一條款「全文」。
     * 任一批失敗直接拋出讓整案 FAILED（不部分成功）。
     */
    @Action
    public ClauseFindings reviewClauses(ContractInput input, ContractBrainstorm brainstorm, ResearchResult research,
                                        ClarifiedAnswers answers, OperationContext context) {
        List<Clause> clauses = brainstorm.clauses().isEmpty() ? List.of(new Clause("全文", input.text())) : brainstorm.clauses();
        List<List<Clause>> batches = batches(clauses);
        List<ClauseFinding> merged = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        for (int i = 0; i < batches.size(); i++) {
            ClauseFindings part;
            try {
                part = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                        .createObject(ContractPrompts.review(input, brainstorm, batches.get(i), i + 1, batches.size(), research, answers), ClauseFindings.class);
            } catch (RuntimeException failure) {
                throw new IllegalStateException(REVIEW_BATCH_FAILED + " batch " + (i + 1) + " of " + batches.size(), failure);
            }
            if (part == null) throw new IllegalStateException(REVIEW_BATCH_FAILED + " batch " + (i + 1) + " of " + batches.size() + " returned nothing");
            merged.addAll(part.findings());
            notes.addAll(part.notes());
        }
        return TaiwanTerminology.sanitize(filterCitations(new ClauseFindings(merged, notes), research));
    }

    /** 步驟 SUMMARY（本里程碑的 goal）：整體風險由 Java 依 findings 取最高，findings 以審查結果為準。 */
    @AchievesGoal(description = "A compliance report rating every clause of the contract")
    @Action
    public ComplianceReport summarizeCompliance(ContractInput input, ContractBrainstorm brainstorm, ClauseFindings findings, OperationContext context) {
        ComplianceReport draft = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.summarize(input, brainstorm, findings), ComplianceReport.class);
        if (draft == null) draft = new ComplianceReport(brainstorm.contractType(), brainstorm.scopes(), null, findings.findings(), List.of(), null);
        ComplianceReport fixed = new ComplianceReport(
                draft.contractType().isBlank() ? brainstorm.contractType() : draft.contractType(),
                draft.scopes().isEmpty() ? brainstorm.scopes() : draft.scopes(),
                ComplianceReport.highest(findings.findings()), findings.findings(), draft.priorities(), draft.disclaimer());
        return TaiwanTerminology.sanitize(fixed);
    }
}
