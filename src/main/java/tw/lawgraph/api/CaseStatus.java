package tw.lawgraph.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.DraftedDocument;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;

import java.util.List;

/** 前端輪詢與 WebMCP getCaseStatus 共用的唯一狀態契約。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CaseStatus(String caseId, String status, String step, String locale,
                         List<Question> questions, Result result, ErrorInfo error) {
    /** COMPLETED 時的分析結果與勾選書狀（documents 未勾選時為 null 或空清單）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Result(BrainstormResult brainstorm, ResearchResult research,
                         AnalysisResult analysis, CaseAssessment assessment, List<DraftedDocument> documents, GraphData graph) {}

    /** FAILED 時的錯誤代碼、訊息與步驟。 */
    public record ErrorInfo(String code, String message, String step) {}
}
