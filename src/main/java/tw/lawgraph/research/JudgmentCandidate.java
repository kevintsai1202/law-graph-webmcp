package tw.lawgraph.research;

import java.util.Set;

/** MCP adapter 正規化後的內部判決候選，不直接暴露給 REST 或前端。 */
public record JudgmentCandidate(String rawId,
                                String canonicalJid,
                                String citation,
                                String court,
                                String date,
                                String summary,
                                String fullText,
                                String url,
                                Set<ResearchSource> sources,
                                Integer keywordRank,
                                Double semanticScore,
                                String citationId,
                                boolean citationAllowed,
                                boolean fullTextVerified) {

    /** 正規化選填字串與來源集合，保留 rawId 原值供追蹤。 */
    public JudgmentCandidate {
        rawId = blankToNull(rawId);
        canonicalJid = blankToNull(canonicalJid);
        citation = blankToNull(citation);
        court = blankToNull(court);
        date = blankToNull(date);
        summary = blankToNull(summary);
        fullText = blankToNull(fullText);
        url = blankToNull(url);
        sources = sources == null ? Set.of() : Set.copyOf(sources);
        citationId = blankToNull(citationId);
        if (keywordRank != null && keywordRank < 0) keywordRank = null;
        if (semanticScore != null && semanticScore.isNaN()) semanticScore = null;
    }

    /** 將空白欄位轉成 null，避免空字串被誤當成可信證據。 */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
