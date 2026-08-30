package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseInput;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Prompt 是技能與模型之間的契約，用字串斷言鎖住關鍵句。 */
class LegalPromptsTest {
    private final CaseInput input = new CaseInput("A rear-ended B at a crossing.", Locale.EN);

    /** system prompt 必須固定工具對映、降級、語系、雙寫與提問規則。 */
    @Test
    void systemPromptCarriesToolMappingLocaleAndCitationRule() {
        String prompt = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(prompt.contains("taiwan-legal-db:search_judgments"), "需說明技能內的前綴工具名對映到裸名");
        assertTrue(prompt.contains("dr-lawbot"), "需宣告 dr-lawbot 不可用並降級");
        assertTrue(prompt.contains("Respond in zh-TW"));
        assertTrue(prompt.contains("（"), "識別碼雙寫規則需含全形括號範例");
        assertTrue(prompt.contains("questions"), "技能要求詢問使用者時改寫入 questions[]");
        assertTrue(LegalPrompts.brainstorm(input).contains("at least 2"),
                "人機協作是核心：頭腦風暴必須至少提出兩個只有使用者知道的事實問題，避免模型跳過等待步驟");
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
        assertTrue(LegalPrompts.analyze(research, brainstorm, Locale.EN).startsWith(
                "Activate skill \"legal-element-analysis\""));
        assertTrue(LegalPrompts.buildGraph(input, brainstorm, research, analysis).startsWith(
                "Activate skill \"legal-graph\" and follow its steps 1–3."));
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
}
