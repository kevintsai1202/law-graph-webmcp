package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.ClarifiedAnswers;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.ResearchResult;
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
        assertTrue(prompt.contains("（"), "識別碼雙寫規則需含全形括號範例");
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
                new AnalysisResult(List.of(), "", List.of(), ""));
        assertTrue(prompt.contains("起訴狀"), "勾選的狀別要以中文名稱要求起草");
        assertTrue(prompt.contains("爭點整理"));
        assertFalse(prompt.contains("答辯狀"), "未勾選的狀別不得出現在要求清單");
        assertTrue(prompt.contains("民法第184條第1項"), "研究結果要原文列入 prompt 供複製");
        assertTrue(prompt.contains("copied verbatim"), "引用只能逐字複製已驗證的法條與判決");
        assertTrue(prompt.contains("issues[]"), "爭點整理要求以表格列（issues[]）輸出");
        assertTrue(prompt.contains("plaintiff") && prompt.contains("defendant") && prompt.contains("evidence"),
                "每列需含兩造主張與證據欄");
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
