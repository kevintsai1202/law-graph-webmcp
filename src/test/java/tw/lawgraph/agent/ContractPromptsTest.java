package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 合約版 prompt 必須啟用 compliance-verification 技能、以 <contract> 框住原文、帶入立場與範疇。 */
class ContractPromptsTest {
    private final ContractInput input = new ContractInput("第一條 乙方自願放棄加班費。", Locale.ZH_TW, "partyB", List.of("labor"), List.of(), "");
    private final ContractBrainstorm brainstorm = new ContractBrainstorm("勞動契約", List.of("labor"), List.of(),
            List.of(new ContractBrainstorm.Clause("第一條", "乙方自願放棄加班費。")), List.of(), "摘要");

    @Test void loadActivatesSkillAndWrapsContract() {
        String p = ContractPrompts.load(input);
        assertTrue(p.startsWith("Activate skill \"compliance-verification\""));
        assertTrue(p.contains("<contract>第一條 乙方自願放棄加班費。</contract>"));
        assertTrue(p.contains("乙方"));
        assertTrue(p.contains("勞動契約（勞動基準法）"));
    }

    @Test void researchDemandsMandatoryArticles() {
        String p = ContractPrompts.research(input, brainstorm, new ClarifiedAnswers(List.of(), List.of()));
        assertTrue(p.contains("民法第71條"));
        assertTrue(p.contains("民法第247條之1"));
        assertTrue(p.contains("ResearchPlan"));
    }

    @Test void reviewMentionsBatchAndAllowlist() {
        var research = new ResearchResult(List.of(new LawRef("勞動基準法第24條", "", "", "")), List.of(), List.of());
        String p = ContractPrompts.review(input, brainstorm, brainstorm.clauses(), 2, 3, research, new ClarifiedAnswers(List.of(), List.of()));
        assertTrue(p.contains("batch 2 of 3"));
        assertTrue(p.contains("ClauseFindings"));
        assertTrue(p.contains("research.laws[].ref"));
    }

    @Test void summarizeAsksForPrioritiesAndDisclaimer() {
        String p = ContractPrompts.summarize(input, brainstorm, new ClauseFindings(List.of(), List.of()));
        assertTrue(p.contains("ComplianceReport"));
        assertTrue(p.contains("priorities"));
    }

    @Test void partyLabels() {
        assertEquals("甲方", ContractPrompts.partyLabel("partyA"));
        assertEquals("乙方", ContractPrompts.partyLabel("partyB"));
        assertEquals("未指定", ContractPrompts.partyLabel("unknown"));
    }
}
