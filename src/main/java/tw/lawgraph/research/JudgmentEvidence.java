package tw.lawgraph.research;

import tw.lawgraph.domain.JudgmentRef;

import java.util.Set;

/** 合併後可供 AI 引用的判決證據與來源 provenance。 */
public record JudgmentEvidence(JudgmentRef judgment,
                               Set<ResearchSource> sources,
                               String citationId,
                               boolean fullTextVerified) {

    /** 保證每筆證據都有既有 JudgmentRef 與不可變來源集合。 */
    public JudgmentEvidence {
        if (judgment == null) throw new IllegalArgumentException("judgment is required");
        sources = sources == null ? Set.of() : Set.copyOf(sources);
        citationId = citationId == null || citationId.isBlank() ? null : citationId.trim();
    }
}
