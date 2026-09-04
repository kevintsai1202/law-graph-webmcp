package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// 匯入 CaseAssessment 與相關類
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.DefenseAssessment;
import tw.lawgraph.domain.EvidenceItem;
import tw.lawgraph.domain.ChecklistItem;
import tw.lawgraph.domain.Risk;

/** 用語守門：大陸或他國法律用語自動替換為台灣實務用語，台灣本有用語不受影響。 */
class TaiwanTerminologyTest {

    /** 常見大陸用語逐一替換；「訴訟費用由」不會被「訴訟費由」規則誤傷。 */
    @Test
    void replacesMainlandTermsWithTaiwanUsage() {
        String text = "依合同約定，原告方之訴訟請求為判令被告方賠償損失賠償金，訴訟費由被告承擔；證據材料見證人證言。人民法院應依民法典審理。";
        String fixed = TaiwanTerminology.sanitize(text);
        assertEquals("依契約約定，原告之訴之聲明為判命被告賠償損害賠償金，訴訟費用由被告負擔；證據方法見證人證述。法院應依民法審理。", fixed);
        assertEquals("訴訟費用由被告負擔。", TaiwanTerminology.sanitize("訴訟費用由被告負擔。"));
        assertTrue(TaiwanTerminology.hits("契約、訴之聲明、兩造、起訴書").isEmpty(), "台灣本有用語（含檢察官起訴書）不得命中");
    }

    /** 命中清單依名單順序去重，供 WARN log 觀察。 */
    @Test
    void reportsHitsInListOrder() {
        assertEquals(List.of("證據材料", "合同", "信息"), TaiwanTerminology.hits("合同的信息與證據材料"));
    }

    /** 書狀與分析結果的每個文字欄位都會被淨化，法條 ref 與 met 不變。 */
    @Test
    void sanitizesDocumentsAndAnalysis() {
        var doc = new DraftedDocument("issues", "爭點整理", "人民法院", List.of(new DraftedDocument.Party("原告方", "甲")),
                List.of("雙方當事人就合同效力有爭執。"), List.of("甲證1–合同"), "",
                List.of(new DraftedDocument.IssueRow("1", "合同是否成立？", "已簽署合同", "甲證1", "未達成合意", "乙證1", "民法第153條")),
                List.of(new DraftedDocument.ClaimBasisRow("1", "民法第184條第1項前段", "被告方應給付損失賠償")),
                List.of(new DraftedDocument.UndisputedRow("1", "雙方當事人於○年簽署合同", "甲證1")));
        var cleaned = TaiwanTerminology.sanitize(new DraftedDocuments(List.of(doc))).documents().getFirst();
        assertEquals("法院", cleaned.court());
        assertEquals("原告", cleaned.parties().getFirst().role());
        assertEquals("兩造就契約效力有爭執。", cleaned.paragraphs().getFirst());
        assertEquals("契約是否成立？", cleaned.issues().getFirst().issue());
        assertEquals("被告應給付損害賠償", cleaned.claimsBasis().getFirst().claim());
        assertEquals("兩造於○年簽署契約", cleaned.undisputed().getFirst().fact());
        assertEquals("民法第153條", cleaned.issues().getFirst().basis());

        var analysis = new AnalysisResult(List.of(new ElementFinding("民法第184條第1項", "過失", Met.yes, "被告方未盡注意義務", "依證據材料")),
                "主張合同無效", List.of("缺乏視頻證據"), "免責");
        var fixedAnalysis = TaiwanTerminology.sanitize(analysis);
        assertEquals("民法第184條第1項", fixedAnalysis.elements().getFirst().law());
        assertEquals(Met.yes, fixedAnalysis.elements().getFirst().met());
        assertEquals("被告未盡注意義務", fixedAnalysis.elements().getFirst().basis());
        assertEquals("主張契約無效", fixedAnalysis.strategy());
        assertEquals(List.of("缺乏影片證據"), fixedAnalysis.evidenceGaps());
    }

    /** CaseAssessment 的抗辯、回應、證據欄位與風險摘要都要過用語守門。 */
    @Test
    void sanitizesCaseAssessmentStrings() {
        var raw = new CaseAssessment(
                List.of(new DefenseAssessment("合同效力", "合同無效", "合同有效", Risk.low)),
                List.of(new EvidenceItem("合同簽署", "原告", "合同影本", "", "調取原本")),
                List.of(new ChecklistItem("證據文件", "合同原本", "證明合同成立", "起訴前")),
                "合同風險低");
        var clean = TaiwanTerminology.sanitize(raw);
        assertEquals("契約效力", clean.defenses().getFirst().issue());
        assertEquals("契約無效", clean.defenses().getFirst().defense());
        assertEquals("契約影本", clean.evidencePlan().getFirst().available());
        assertEquals("契約原本", clean.checklist().getFirst().item());
        assertEquals("契約風險低", clean.riskSummary());
        assertEquals(Risk.low, clean.defenses().getFirst().risk());
    }
}
