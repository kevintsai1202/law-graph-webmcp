package tw.lawgraph.research;

import tw.lawgraph.domain.JudgmentRef;
import tw.lawgraph.domain.LawRef;
import tw.lawgraph.domain.ResearchResult;

import java.util.ArrayList;
import java.util.List;

/** 將雙軌 adapter 結果組裝成既有 ResearchResult 與新的 coverage／evidence 契約。 */
public final class ResearchOutcomeAssembler {
    private final JudgmentMergeService mergeService;

    /** 注入純函式 merge service。 */
    public ResearchOutcomeAssembler(JudgmentMergeService mergeService) {
        this.mergeService = mergeService;
    }

    /** 合併兩軌候選並建立只含白名單判決的研究結果。 */
    public ResearchResult assemble(TaiwanLegalDbPort.LegalDbResearch keyword,
                                   TwLegalRagPort.SemanticResearch semantic,
                                   ResearchTrackStatus keywordStatus,
                                   ResearchTrackStatus semanticStatus,
                                   List<String> notes,
                                   int maxJudgments) {
        return assemble(keyword, semantic, keywordStatus, semanticStatus, notes, maxJudgments, false);
    }

    /** 合併兩軌候選並附上是否需要瀏覽器重新授權的非敏感狀態。 */
    public ResearchResult assemble(TaiwanLegalDbPort.LegalDbResearch keyword,
                                   TwLegalRagPort.SemanticResearch semantic,
                                   ResearchTrackStatus keywordStatus,
                                   ResearchTrackStatus semanticStatus,
                                   List<String> notes,
                                   int maxJudgments,
                                   boolean authorizationRequired) {
        TaiwanLegalDbPort.LegalDbResearch safeKeyword = keyword == null
                ? new TaiwanLegalDbPort.LegalDbResearch(List.of(), List.of()) : keyword;
        TwLegalRagPort.SemanticResearch safeSemantic = semantic == null
                ? new TwLegalRagPort.SemanticResearch(List.of()) : semantic;
        JudgmentMergeService.JudgmentMergeResult merged = mergeService.merge(
                safeKeyword.keywordCandidates(), safeSemantic.semanticCandidates(), maxJudgments);
        List<String> mergedNotes = new ArrayList<>();
        if (notes != null) mergedNotes.addAll(notes);
        mergedNotes.addAll(merged.warnings());
        ResearchCoverage base = merged.coverage();
        ResearchCoverage coverage = new ResearchCoverage(keywordStatus, semanticStatus,
                base.keywordCandidateCount(), base.semanticCandidateCount(), base.mergedCount(),
                base.droppedCount(), base.truncatedCount(), authorizationRequired);
        List<JudgmentRef> judgments = merged.evidence().stream().map(JudgmentEvidence::judgment).toList();
        return new ResearchResult(safeKeyword.laws(), judgments, mergedNotes, coverage, merged.evidence());
    }
}
