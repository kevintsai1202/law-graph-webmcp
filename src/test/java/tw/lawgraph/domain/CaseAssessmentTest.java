package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** CaseAssessment 對 null 欄位的兜底：清單變空、摘要變空字串，前端不會壞頁。 */
class CaseAssessmentTest {
    @Test void nullCollectionsBecomeEmpty() {
        var assessment = new CaseAssessment(null, null, null, null);
        assertEquals(List.of(), assessment.defenses());
        assertEquals(List.of(), assessment.evidencePlan());
        assertEquals(List.of(), assessment.checklist());
        assertEquals("", assessment.riskSummary());
    }

    @Test void keepsProvidedValues() {
        var defense = new DefenseAssessment("時效", "已罹於二年時效", "以知悉時點起算尚未屆滿", Risk.medium);
        var evidence = new EvidenceItem("知悉損害之時點", "被告", "無", "通知函送達證明", "向郵局申請掛號回執");
        var item = new ChecklistItem("證據文件", "通知函掛號回執", "證明知悉時點以對抗時效抗辯", "下次會面前");
        var assessment = new CaseAssessment(List.of(defense), List.of(evidence), List.of(item), "整體風險中等");
        assertEquals(1, assessment.defenses().size());
        assertEquals("證據文件", assessment.checklist().getFirst().category());
        assertEquals(Risk.medium, assessment.defenses().getFirst().risk());
        assertEquals("被告", assessment.evidencePlan().getFirst().burden());
    }
}
