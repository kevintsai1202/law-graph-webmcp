package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 爭點整理表列：null 安全與舊建構子相容。 */
class DraftedDocumentTest {

    /** 舊的 7 參數建構子仍可用，issues 預設為空清單。 */
    @Test
    void legacyConstructorHasEmptyIssues() {
        var doc = new DraftedDocument("complaint", "民事起訴狀", "法院", List.of(), List.of("一、"), List.of(), "");
        assertEquals(List.of(), doc.issues());
    }

    /** LLM 省略 issues 或列內欄位為 null 時一律正規化。 */
    @Test
    void normalizesNullIssueRows() {
        var row = new DraftedDocument.IssueRow(null, "被告有無過失？", null, null, "否認過失", "乙證1", null);
        var doc = new DraftedDocument("issues", "爭點整理", "法院", null, null, null, null, java.util.Arrays.asList(row, null));
        assertEquals(1, doc.issues().size());
        assertEquals("", doc.issues().getFirst().no());
        assertEquals("", doc.issues().getFirst().plaintiff());
        assertEquals("", doc.issues().getFirst().plaintiffEvidence());
        assertEquals("否認過失", doc.issues().getFirst().defendant());
        assertEquals("乙證1", doc.issues().getFirst().defendantEvidence());
        assertEquals(List.of(), doc.paragraphs());
        assertEquals(List.of(), doc.claimsBasis());
        assertEquals(List.of(), doc.undisputed());
        var full = new DraftedDocument("preparatory", "民事準備書狀", "法院", null, null, null, null, null,
                java.util.Arrays.asList(new DraftedDocument.ClaimBasisRow("1", "民法第184條第1項前段", null), null),
                List.of(new DraftedDocument.UndisputedRow(null, "兩造於○年簽約", "甲證1")));
        assertEquals("", full.claimsBasis().getFirst().claim());
        assertEquals("兩造於○年簽約", full.undisputed().getFirst().fact());
    }
}
