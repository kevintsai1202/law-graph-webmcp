package tw.lawgraph.domain;

import tw.lawgraph.research.JudgmentEvidence;
import tw.lawgraph.research.ResearchCoverage;

import java.util.List;

/** 法規與裁判檢索結果，以及檢索或過濾過程的附註。 */
public record ResearchResult(List<LawRef> laws,
                             List<JudgmentRef> judgments,
                             List<String> notes,
                             ResearchCoverage coverage,
                             List<JudgmentEvidence> evidence) {

    /** 維持既有三參數呼叫端，新增欄位採安全空值預設。 */
    public ResearchResult(List<LawRef> laws, List<JudgmentRef> judgments, List<String> notes) {
        this(laws, judgments, notes, ResearchCoverage.empty(), List.of());
    }

    /** 將 REST／AI 契約集合複製成不可變資料，避免流程狀態被外部修改。 */
    public ResearchResult {
        laws = laws == null ? List.of() : List.copyOf(laws);
        judgments = judgments == null ? List.of() : List.copyOf(judgments);
        notes = notes == null ? List.of() : List.copyOf(notes);
        coverage = coverage == null ? ResearchCoverage.empty() : coverage;
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
    }

    /** 以新附註建立相同研究內容，供 StatusMapper 合併 GraphRules 訊息。 */
    public ResearchResult withNotes(List<String> replacementNotes) {
        return new ResearchResult(laws, judgments, replacementNotes, coverage, evidence);
    }
}
