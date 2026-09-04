package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 書狀類型正規化契約：過濾未知代碼、去重並固定為法定順序。 */
class DocumentTypesTest {

    /** 未知代碼剔除、重複合併、輸出依 CODES 固定順序。 */
    @Test
    void normalizeFiltersUnknownAndKeepsCanonicalOrder() {
        assertEquals(List.of("complaint", "defense"),
                DocumentTypes.normalize(List.of("defense", "bogus", "complaint", "defense")));
    }

    /** null 輸入視為未勾選任何書狀。 */
    @Test
    void normalizeTreatsNullAsEmpty() {
        assertEquals(List.of(), DocumentTypes.normalize(null));
    }

    /** 八種書狀代碼都要有對應中文狀別名稱。 */
    @Test
    void everyCodeHasChineseTitle() {
        assertEquals(8, DocumentTypes.CODES.size());
        for (String code : DocumentTypes.CODES) {
            assertEquals(false, DocumentTypes.chineseTitle(code).isBlank());
        }
        assertEquals("起訴狀", DocumentTypes.chineseTitle("complaint"));
        assertEquals("爭點整理", DocumentTypes.chineseTitle("issues"));
    }

    /** CaseInput 建構時就完成正規化，舊的兩參數建構子等同未勾選。 */
    @Test
    void caseInputNormalizesDocuments() {
        assertEquals(List.of(), new CaseInput("t", Locale.EN).documents());
        assertEquals(List.of("appeal"),
                new CaseInput("t", Locale.EN, List.of("appeal", "nope")).documents());
    }
}
