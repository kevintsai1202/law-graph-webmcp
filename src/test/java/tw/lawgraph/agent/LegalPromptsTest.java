package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.ClarifiedAnswers;
import tw.lawgraph.domain.DefenseAssessment;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.Risk;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Prompt 是技能與模型之間的契約，用字串斷言鎖住關鍵句。 */
class LegalPromptsTest {
    private final CaseInput input = new CaseInput("A rear-ended B at a crossing.", Locale.EN);

    /** system prompt 必須固定工具對映、雙軌降級、語系、雙寫與提問規則。 */
    @Test
    void systemPromptCarriesToolMappingLocaleAndCitationRule() {
        String prompt = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(prompt.contains("taiwan-legal-db:search_judgments"), "需說明技能內的前綴工具名對映到裸名");
        assertTrue(prompt.contains("dr-lawbot"), "需宣告語意軌的來源 identity");
        assertTrue(prompt.contains("semantic track"), "需宣告雙軌 coverage 與降級規則");
        assertTrue(prompt.contains("Respond in zh-TW"));
        assertTrue(prompt.contains("written once, in Chinese"), "中文介面識別碼只寫一次，不得雙寫");
        assertTrue(prompt.contains("Never repeat the same identifier in parentheses"));
        assertTrue(LegalPrompts.system(Locale.EN).contains("（"), "英文介面才要求英文標籤＋全形括號中文雙寫");
        assertTrue(prompt.contains("questions"), "技能要求詢問使用者時改寫入 questions[]");
        assertTrue(LegalPrompts.brainstorm(input).contains("empty questions[]"),
                "案情與附件已明確時，模型必須能回空問題清單並略過等待步驟");
        assertTrue(LegalPrompts.brainstorm(input).contains("materially change"),
                "只有會實質影響結論、期限或證據評價的缺漏才能觸發追問");
    }

    /** 每個 user prompt 都必須由指定技能啟用句開始。 */
    @Test
    void everyUserPromptStartsWithActivateSentence() {
        var brainstorm = new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of());
        var research = new ResearchResult(List.of(), List.of(), List.of());
        var analysis = new AnalysisResult(List.of(), "", List.of(), "");
        assertTrue(LegalPrompts.brainstorm(input).startsWith(
                "Activate skill \"legal-brainstorming\" and follow its steps 1–4."));
        assertTrue(LegalPrompts.research(input, brainstorm, new UserAnswers(List.of())).startsWith(
                "Activate skill \"legal-research\" and follow its steps 1–4."));
        assertTrue(LegalPrompts.research(input, brainstorm, new UserAnswers(List.of()))
                .contains("ResearchPlan"));
        assertTrue(LegalPrompts.research(input, brainstorm, new ClarifiedAnswers(List.of(), List.of())).startsWith(
                "Activate skill \"legal-research\" and follow its steps 1–4."));
        assertTrue(LegalPrompts.analyze(research, brainstorm, Locale.EN).startsWith(
                "Activate skill \"legal-element-analysis\""));
        assertTrue(LegalPrompts.buildGraph(input, brainstorm, research, analysis).startsWith(
                "Activate skill \"legal-graph\" and follow its steps 1–3."));
    }

    /** 後續完整度判斷必須鎖住輪次、禁止重問與不知道的終止語意。 */
    @Test
    void clarificationPromptPreventsRepeatedQuestions() {
        String prompt = LegalPrompts.clarify(input,
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()),
                List.of(new UserAnswers(List.of())), List.of(), 2);
        assertTrue(prompt.contains("round 2 of 3"));
        assertTrue(prompt.contains("Never repeat"));
        assertTrue(prompt.contains("不知道"));
        assertTrue(prompt.contains("r2q1"));
    }

    /** 起草書狀 prompt 只列勾選狀別、附上已驗證引用並要求結構化輸出。 */
    @Test
    void draftDocumentsPromptListsSelectedTypesAndLocksCitations() {
        var docInput = new CaseInput("A rear-ended B.", Locale.ZH_TW, java.util.List.of("complaint", "issues"));
        var research = new ResearchResult(
                List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "", "")), List.of(), List.of());
        String prompt = LegalPrompts.draftDocuments(docInput,
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()), research,
                new AnalysisResult(List.of(), "", List.of(), ""),
                new CaseAssessment(List.of(), List.of(), List.of(), ""));
        assertTrue(prompt.contains("起訴狀"), "勾選的狀別要以中文名稱要求起草");
        assertTrue(prompt.contains("爭點整理"));
        assertFalse(prompt.contains("答辯狀 (type="), "未勾選的狀別不得出現在要求清單（assessment 規則行固定提及答辯狀，不在此列）");
        assertTrue(prompt.contains("民法第184條第1項"), "研究結果要原文列入 prompt 供複製");
        assertTrue(prompt.contains("copied verbatim"), "引用只能逐字複製已驗證的法條與判決");
        assertTrue(prompt.contains("issues[]"), "爭點整理要求以表格列（issues[]）輸出");
        assertTrue(prompt.contains("plaintiffEvidence") && prompt.contains("defendantEvidence") && prompt.contains("claimsBasis[]")
                && prompt.contains("undisputed[]"), "需對應司法院官方四表欄位");
        assertTrue(prompt.contains("訴之聲明") && prompt.contains("願供擔保，請准宣告假執行"), "起訴狀需帶入司法院範本結構");
        assertTrue(prompt.contains("民事訴訟法第268條之1"), "爭點整理需帶入官方表格依據");
        assertFalse(prompt.contains("民事答辯狀（司法院範本"), "未勾選的狀別不得帶入其範本");
        assertTrue(prompt.contains("Taiwan terminology only"));
    }

    /** 書狀 prompt 帶入抗辯評估，要求答辯狀／準備書狀逐項回應對造抗辯。 */
    @Test
    void draftPromptIncludesAssessment() {
        var assessment = new CaseAssessment(
                List.of(new DefenseAssessment("時效", "已罹於時效", "尚未屆滿", Risk.high)), List.of(), List.of(), "");
        String prompt = LegalPrompts.draftDocuments(new CaseInput("A hit B", Locale.ZH_TW, List.of("answer"), ""),
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()),
                new ResearchResult(List.of(), List.of(), List.of()),
                new AnalysisResult(List.of(), "", List.of(), ""), assessment);
        assertTrue(prompt.contains("<assessment>"));
        assertTrue(prompt.contains("已罹於時效"));
        assertTrue(prompt.contains("assessment.defenses"));
    }

    /** 勾選聲請狀且填寫聲請事項時，prompt 要帶入聲請事項與聲請狀範本；系統 prompt 需含用語與精簡規範。 */
    @Test
    void motionRequestAndRegisterRulesFlowIntoPrompts() {
        var motionInput = new CaseInput("A rear-ended B.", Locale.ZH_TW, java.util.List.of("motion"), "聲請調查行車紀錄器影像");
        String prompt = LegalPrompts.draftDocuments(motionInput,
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()),
                new ResearchResult(List.of(), List.of(), List.of()), new AnalysisResult(List.of(), "", List.of(), ""),
                new CaseAssessment(List.of(), List.of(), List.of(), ""));
        assertTrue(prompt.contains("聲請調查行車紀錄器影像"));
        assertTrue(prompt.contains("民事聲請○○狀"));
        String system = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(system.contains("契約 not 合同") && system.contains("兩造"), "系統 prompt 需列台灣用語規範");
        assertTrue(system.contains("one legal point per paragraph"), "系統 prompt 需要求精簡攻防寫法");
    }

    /** 建圖 prompt 必須要求 ref、jid 逐字複製且禁止模型自填 met。 */
    @Test
    void buildGraphPromptTellsModelToCopyRefAndJidVerbatim() {
        var research = new ResearchResult(
                List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "", "")), List.of(), List.of());
        String prompt = LegalPrompts.buildGraph(input,
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()), research,
                new AnalysisResult(List.of(), "", List.of(), ""));
        assertTrue(prompt.contains("民法第184條第1項"), "研究結果要原文列入 prompt 供複製");
        assertTrue(prompt.contains("\"ref\""), "需說明 law 節點的 ref 欄位");
        assertTrue(prompt.contains("\"jid\""), "需說明 judgment 節點的 jid 欄位");
        assertTrue(prompt.contains("do not set \"met\""), "met 由 Java 覆寫，模型不得自填");
    }

    /** 抗辯評估 prompt 必須啟用涵攝技能、鎖定引用白名單、規定舉證責任字串並要求逐爭點列抗辯。 */
    @Test void assessPromptCoversDefensesBurdenAndAllowlist() {
        var research = new ResearchResult(List.of(), List.of(), List.of());
        var brainstorm = new BrainstormResult(List.of("f"), List.of(), List.of("時效是否完成"), List.of(), List.of());
        var analysis = new AnalysisResult(List.of(), "", List.of(), "");
        var answers = new ClarifiedAnswers(List.of(), List.of("無送達證明"));
        String prompt = LegalPrompts.assess(new CaseInput("A hit B", Locale.ZH_TW), brainstorm, research, analysis, answers);
        assertTrue(prompt.startsWith("Activate skill \"legal-element-analysis\""));
        assertTrue(prompt.contains("defenses"));
        assertTrue(prompt.contains("evidencePlan"));
        assertTrue(prompt.contains("checklist"));
        assertTrue(prompt.contains("證據文件|人證|程序事項|費用與期限|其他"));
        assertTrue(prompt.contains("民事訴訟法第277條"));
        assertTrue(prompt.contains("原告|被告|檢察官|不明"));
        assertTrue(prompt.contains("never search for new judgments"));
        assertTrue(prompt.contains("時效是否完成"));
        assertTrue(prompt.contains("無送達證明"));
        assertTrue(prompt.contains("Respond in zh-TW"));
    }

    /** 對當事人的問題與清單要白話並附專業名詞；分析、抗辯回應與書狀維持專業用語。 */
    @Test void promptsSeparatePlainQuestionsFromProfessionalOutput() {
        var input = new CaseInput("A hit B", Locale.ZH_TW);
        var brainstorm = new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of());
        String system = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(system.contains("plain language"));
        assertTrue(system.contains("professional term in parentheses"));
        String bs = LegalPrompts.brainstorm(input);
        assertTrue(bs.contains("questions[].text and why: plain language"));
        String clarify = LegalPrompts.clarify(input, brainstorm, List.of(), List.of(), 2);
        assertTrue(clarify.contains("plain language"));
        String assess = LegalPrompts.assess(input, brainstorm, new ResearchResult(List.of(), List.of(), List.of()),
                new AnalysisResult(List.of(), "", List.of(), ""), new ClarifiedAnswers(List.of(), List.of()));
        assertTrue(assess.contains("checklist rows: plain language"));
        assertTrue(assess.contains("defenses, evidencePlan and riskSummary: professional Taiwan legal register"));
    }

    /** 分析 prompt 必須使用 merged coverage，且禁止繞過白名單重新搜尋。 */
    @Test
    void analyzePromptReadsCoverageWithoutSearch() {
        String prompt = LegalPrompts.analyze(new ResearchResult(List.of(), List.of(), List.of()),
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()), Locale.ZH_TW);

        assertTrue(prompt.contains("research.evidence"));
        assertTrue(prompt.contains("coverage.semanticStatus"));
        assertTrue(prompt.contains("never search for new judgments"));
    }
}
