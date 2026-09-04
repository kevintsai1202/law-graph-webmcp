package tw.lawgraph.research;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.ResearchResult;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 驗證雙 MCP 研究資料契約的空值正規化與不可變集合行為。 */
class ResearchContractsTest {

    /** 空白查詢不得流入 adapter，且各集合需可安全重複使用。 */
    @Test
    void normalizesBlankQueriesAndNullCollections() {
        var plan = new ResearchPlan(null, List.of(
                new ResearchPlan.JudgmentKeywordQuery("  ", null, null, null, null, null),
                new ResearchPlan.JudgmentKeywordQuery("車禍 損害賠償", null, null, null, null, 5)), "  ");

        assertEquals(List.of(), plan.regulationQueries());
        assertEquals(List.of(new ResearchPlan.JudgmentKeywordQuery(
                "車禍 損害賠償", "", "", "", "", 5)), plan.judgmentKeywordQueries());
        assertEquals("", plan.semanticCaseText());
    }

    /** 公開契約不應讓呼叫端修改內部研究狀態。 */
    @Test
    void exposesImmutableCollections() {
        var candidate = new JudgmentCandidate("J1", "J1", "citation", "court", "date", "summary",
                "full text", "url", Set.of(ResearchSource.KEYWORD), 1, null, null, true, true);
        var plan = new ResearchPlan(List.of("民法"), List.of(), "案情");
        var result = new ResearchResult(List.of(), List.of(), List.of(),
                new ResearchCoverage(ResearchTrackStatus.SUCCESS, ResearchTrackStatus.UNAVAILABLE,
                        1, 0, 1, 0, 0), List.of(new JudgmentEvidence(
                        new tw.lawgraph.domain.JudgmentRef("J1", "citation", "court", "date", "summary", "url"),
                        Set.of(ResearchSource.KEYWORD), null, true)));

        assertEquals("案情", plan.semanticCaseText());
        assertThrows(UnsupportedOperationException.class, () -> result.notes().add("x"));
        assertThrows(UnsupportedOperationException.class, () -> candidate.sources().add(ResearchSource.SEMANTIC));
        assertThrows(UnsupportedOperationException.class, () -> result.evidence().clear());
    }

    /** null 的研究結果集合需轉為空集合，維持既有三參數建構子的相容性。 */
    @Test
    void keepsBackwardCompatibleResearchResultConstructor() {
        var result = new ResearchResult(null, null, null);

        assertEquals(List.of(), result.laws());
        assertEquals(List.of(), result.judgments());
        assertEquals(List.of(), result.notes());
        assertEquals(ResearchTrackStatus.UNAVAILABLE, result.coverage().semanticStatus());
        assertEquals(List.of(), result.evidence());
    }
}
