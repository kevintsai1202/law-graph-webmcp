package tw.lawgraph.research;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 驗證雙軌候選的去重、可信內容選擇、穩定排序與上限。 */
class JudgmentMergeServiceTest {

    private final JudgmentMergeService service = new JudgmentMergeService();

    /** 相同 canonical JID 應合成一筆，並聯集雙軌來源。 */
    @Test
    void mergesDuplicateJidAndPrefersVerifiedFullText() {
        var keyword = candidate(" TPSV,108,台上,2345 ", "最高法院108年度台上字第2345號", "短摘要",
                "", Set.of(ResearchSource.KEYWORD), 2, null, true, false);
        var semantic = candidate("tpsv, 108, 台上, 2345", "最高法院108年度台上字第2345號", "完整摘要",
                "完整理由書", Set.of(ResearchSource.SEMANTIC), null, .92, true, true);

        var merged = service.merge(List.of(keyword), List.of(semantic), 10);

        assertEquals(1, merged.evidence().size());
        var evidence = merged.evidence().getFirst();
        assertEquals(Set.of(ResearchSource.KEYWORD, ResearchSource.SEMANTIC), evidence.sources());
        assertEquals("完整摘要", evidence.judgment().summary());
        assertTrue(evidence.fullTextVerified());
        assertEquals(1, merged.coverage().mergedCount());
    }

    /** 缺 JID 或未通過 semantic citation allowlist 的候選不得進 AI 白名單。 */
    @Test
    void dropsUntrustedCandidatesAndCountsThem() {
        var missingId = candidate(" ", "not allowed", "summary", "text", Set.of(ResearchSource.KEYWORD),
                1, null, true, true);
        var notAllowed = candidate("J2", "not allowed", "summary", "text", Set.of(ResearchSource.SEMANTIC),
                null, .8, false, true);

        var merged = service.merge(List.of(missingId), List.of(notAllowed), 10);

        assertTrue(merged.evidence().isEmpty());
        assertEquals(2, merged.coverage().droppedCount());
    }

    /** 輸入完成順序改變時，輸出仍依固定 comparator 排序且截斷後只保留白名單內容。 */
    @Test
    void sortingIsDeterministicAndAppliesLimitAfterMerge() {
        var a = candidate("J-A", "A", "", "", Set.of(ResearchSource.KEYWORD), 2, null, true, false);
        var b = candidate("J-B", "B", "", "", Set.of(ResearchSource.SEMANTIC), null, .7, true, false);
        var dual = candidate("J-A", "A", "better", "", Set.of(ResearchSource.SEMANTIC), null, .6, true, false);

        var first = service.merge(List.of(a), List.of(b, dual), 1);
        var reversed = service.merge(List.of(a), List.of(dual, b), 1);

        assertEquals(first.evidence(), reversed.evidence());
        assertEquals("J-A", first.evidence().getFirst().judgment().jid());
        assertEquals(1, first.coverage().truncatedCount());
    }

    /** 建立測試候選，避免測試重複攤開 production 欄位意義。 */
    private static JudgmentCandidate candidate(String rawId, String citation, String summary, String fullText,
                                               Set<ResearchSource> sources, Integer keywordRank,
                                               Double semanticScore, boolean citationAllowed,
                                               boolean fullTextVerified) {
        return new JudgmentCandidate(rawId, null, citation, "最高法院", "2024-01-01", summary, fullText,
                "https://example.invalid/judgment", sources, keywordRank, semanticScore, "C1",
                citationAllowed, fullTextVerified);
    }
}
