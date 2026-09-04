package tw.lawgraph.research;

import tw.lawgraph.domain.JudgmentRef;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 以 canonical JID 執行雙軌判決合併、信任閘門、排序與截斷。 */
public final class JudgmentMergeService {

    /** 合併後的引用白名單、警告與統計。 */
    public record JudgmentMergeResult(List<JudgmentEvidence> evidence,
                                      List<String> warnings,
                                      ResearchCoverage coverage) {
        /** 保證 merge 結果集合不可變。 */
        public JudgmentMergeResult {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
            warnings = warnings == null ? List.of() : List.copyOf(warnings);
            coverage = coverage == null ? ResearchCoverage.empty() : coverage;
        }
    }

    /** 依固定規則合併兩軌候選；不讀取 clock、env、MCP 或 LLM。 */
    public JudgmentMergeResult merge(List<JudgmentCandidate> keywordCandidates,
                                     List<JudgmentCandidate> semanticCandidates,
                                     int maxResults) {
        List<JudgmentCandidate> keyword = safe(keywordCandidates);
        List<JudgmentCandidate> semantic = safe(semanticCandidates);
        Map<String, List<JudgmentCandidate>> grouped = new LinkedHashMap<>();
        int dropped = 0;

        for (JudgmentCandidate candidate : keyword) {
            if (accept(candidate, ResearchSource.KEYWORD)) {
                grouped.computeIfAbsent(key(candidate), ignored -> new ArrayList<>()).add(candidate);
            } else {
                dropped++;
            }
        }
        for (JudgmentCandidate candidate : semantic) {
            if (accept(candidate, ResearchSource.SEMANTIC)) {
                grouped.computeIfAbsent(key(candidate), ignored -> new ArrayList<>()).add(candidate);
            } else {
                dropped++;
            }
        }

        List<String> warnings = new ArrayList<>();
        List<MergedEvidence> merged = grouped.entrySet().stream()
                .map(entry -> mergeGroup(entry.getKey(), entry.getValue(), warnings))
                .sorted(mergedEvidenceComparator())
                .toList();
        int limit = Math.max(0, maxResults);
        int truncated = Math.max(0, merged.size() - limit);
        List<JudgmentEvidence> limited = merged.subList(0, Math.min(limit, merged.size())).stream()
                .map(MergedEvidence::evidence).toList();
        ResearchCoverage coverage = new ResearchCoverage(ResearchTrackStatus.SUCCESS,
                ResearchTrackStatus.SUCCESS, keyword.size(), semantic.size(), limited.size(), dropped, truncated);
        return new JudgmentMergeResult(limited, warnings, coverage);
    }

    /** 將候選集合安全化，避免 MCP 異常資料造成 NullPointerException。 */
    private static List<JudgmentCandidate> safe(List<JudgmentCandidate> candidates) {
        return candidates == null ? List.of() : candidates.stream().filter(java.util.Objects::nonNull).toList();
    }

    /** 套用 JID 必須存在與 semantic citation allowlist 必須通過的信任閘門。 */
    private static boolean accept(JudgmentCandidate candidate, ResearchSource expectedSource) {
        if (candidate.sources().isEmpty() || !candidate.sources().contains(expectedSource)) return false;
        return !JudgmentIdNormalizer.key(candidate.rawId()).isEmpty()
                && (expectedSource != ResearchSource.SEMANTIC || candidate.citationAllowed());
    }

    /** 取得候選分組鍵；呼叫端已先通過 JID 信任閘門。 */
    private static String key(JudgmentCandidate candidate) {
        return JudgmentIdNormalizer.canonicalize(candidate.rawId());
    }

    /** 將同一 JID 的候選挑出最佳欄位並聯集 provenance。 */
    private static MergedEvidence mergeGroup(String canonicalJid,
                                             List<JudgmentCandidate> candidates,
                                             List<String> warnings) {
        JudgmentCandidate selected = candidates.stream().sorted(candidateQuality()).findFirst().orElseThrow();
        Set<ResearchSource> sources = candidates.stream().flatMap(candidate -> candidate.sources().stream())
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(ResearchSource.class)));
        warnOnConflicts(canonicalJid, candidates, "citation", JudgmentCandidate::citation, warnings);
        warnOnConflicts(canonicalJid, candidates, "court", JudgmentCandidate::court, warnings);
        warnOnConflicts(canonicalJid, candidates, "date", JudgmentCandidate::date, warnings);
        warnOnConflicts(canonicalJid, candidates, "summary", JudgmentCandidate::summary, warnings);
        String citation = bestText(candidates, JudgmentCandidate::citation);
        String court = bestText(candidates, JudgmentCandidate::court);
        String date = bestText(candidates, JudgmentCandidate::date);
        String summary = bestText(candidates, JudgmentCandidate::summary);
        String url = bestText(candidates, JudgmentCandidate::url);
        String jid = selected.rawId();
        JudgmentRef judgment = new JudgmentRef(jid, citation, court, date, summary, url);
        String citationId = bestText(candidates, JudgmentCandidate::citationId);
        boolean fullTextVerified = candidates.stream().anyMatch(JudgmentCandidate::fullTextVerified);
        return new MergedEvidence(new JudgmentEvidence(judgment, sources, citationId, fullTextVerified),
                selected.semanticScore(), selected.keywordRank(), canonicalJid);
    }

    /** 選擇確定性最佳非空欄位，不依賴 MCP 回傳順序。 */
    private static String bestText(List<JudgmentCandidate> candidates,
                                   java.util.function.Function<JudgmentCandidate, String> getter) {
        return candidates.stream().filter(candidate -> getter.apply(candidate) != null)
                .sorted(candidateQuality().thenComparing(candidate -> safeText(getter.apply(candidate))))
                .map(getter).findFirst().orElse(null);
    }

    /** 只在不同非空值存在時產生安全的欄位衝突 metadata。 */
    private static void warnOnConflicts(String jid, List<JudgmentCandidate> candidates, String field,
                                       java.util.function.Function<JudgmentCandidate, String> getter,
                                       List<String> warnings) {
        long distinct = candidates.stream().map(getter).filter(value -> value != null && !value.isBlank()).distinct().count();
        if (distinct > 1) warnings.add("conflicting " + field + " for jid=" + jid);
    }

    /** 合併後排序：雙軌命中、全文驗證、語意分數、關鍵字排名、canonical JID。 */
    private static Comparator<MergedEvidence> mergedEvidenceComparator() {
        return Comparator.comparingInt((MergedEvidence value) -> value.evidence().sources().size()).reversed()
                .thenComparing(value -> value.evidence().fullTextVerified(), Comparator.reverseOrder())
                .thenComparing(MergedEvidence::semanticScore, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(MergedEvidence::keywordRank, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(MergedEvidence::canonicalJid);
    }

    /** 候選內容完整度排序；優先已驗證全文，再看 citation 與可排序分數。 */
    private static Comparator<JudgmentCandidate> candidateQuality() {
        return Comparator.comparing(JudgmentCandidate::fullTextVerified).reversed()
                .thenComparing(JudgmentCandidate::citationAllowed, Comparator.reverseOrder())
                .thenComparing(Comparator.comparingInt(JudgmentMergeService::contentCompleteness).reversed())
                .thenComparing(JudgmentCandidate::semanticScore, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(JudgmentCandidate::keywordRank, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(candidate -> safeText(candidate.rawId()));
    }

    /** 計算欄位完整度，作為品質排序的穩定次要條件。 */
    private static int contentCompleteness(JudgmentCandidate candidate) {
        return (candidate.citation() == null ? 0 : 1)
                + (candidate.court() == null ? 0 : 1)
                + (candidate.date() == null ? 0 : 1)
                + (candidate.summary() == null ? 0 : 1)
                + (candidate.fullText() == null ? 0 : 1)
                + (candidate.url() == null ? 0 : 1);
    }

    /** 將 null 安全轉成排序文字。 */
    private static String safeText(String value) {
        return value == null ? "" : value;
    }

    /** 供排序使用的內部 merged metadata；不會暴露到 REST／AI 契約。 */
    private record MergedEvidence(JudgmentEvidence evidence, Double semanticScore,
                                  Integer keywordRank, String canonicalJid) {}
}
