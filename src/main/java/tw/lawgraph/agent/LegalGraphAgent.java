package tw.lawgraph.agent;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.core.hitl.WaitFor;
import com.embabel.agent.skills.Skills;
import tw.lawgraph.agent.config.ToolGroupsConfig;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.GraphRules;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

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

    /** 注入已驗證載入的 law-powers 技能集合。 */
    public LegalGraphAgent(Skills skills) {
        this.skills = skills;
    }

    /** 步驟一：產生事實、法律關係、爭點、證據需求與待問問題。 */
    @Action
    public BrainstormResult brainstorm(CaseInput input, OperationContext context) {
        return context.ai().withDefaultLlm()
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

    /** 步驟三：以 taiwan-legal-db 檢索法條與判決。 */
    @Action
    public ResearchResult research(CaseInput input, BrainstormResult brainstorm, UserAnswers answers,
                                   OperationContext context) {
        return context.ai().withDefaultLlm()
                .withReference(skills)
                .withToolGroup(ToolGroupsConfig.LEGAL_DB)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.research(input, brainstorm, answers), ResearchResult.class);
    }

    /** 步驟四：逐一分析法律要件是否該當。 */
    @Action
    public AnalysisResult analyze(ResearchResult research, BrainstormResult brainstorm, CaseInput input,
                                  OperationContext context) {
        return context.ai().withDefaultLlm()
                .withReference(skills)
                .withToolGroup(ToolGroupsConfig.LEGAL_DB)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.analyze(research, brainstorm, input.locale()), AnalysisResult.class);
    }

    /** 步驟五：產生 3D 圖資料並套用四條硬規則。 */
    @AchievesGoal(description = "A verified legal relationship graph for the case")
    @Action
    public GraphOutcome buildGraph(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                   AnalysisResult analysis, OperationContext context) {
        GraphData raw = context.ai().withDefaultLlm()
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.buildGraph(input, brainstorm, research, analysis), GraphData.class);
        return GraphRules.apply(raw, research, analysis);
    }
}
