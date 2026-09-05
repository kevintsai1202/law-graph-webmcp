package tw.lawgraph.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.ClauseFindings;
import tw.lawgraph.domain.ComplianceReport;
import tw.lawgraph.domain.ContractBrainstorm;
import tw.lawgraph.domain.DraftedDocument;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.RevisedClauses;

import java.util.List;

/** 前端輪詢與 WebMCP getCaseStatus 共用的唯一狀態契約；mode 告訴前端走哪套步驤與分頁。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CaseStatus(String caseId, String status, String step, String locale,
                         List<Question> questions, Result result, ErrorInfo error, String mode) {
    /** 正規化 mode，未知一律視為案件模式。 */
    public CaseStatus { mode = CaseMode.normalize(mode); }

    /** 相容既有呼叫端：案件模式。 */
    public CaseStatus(String caseId, String status, String step, String locale, List<Question> questions, Result result, ErrorInfo error) {
        this(caseId, status, step, locale, questions, result, error, CaseMode.CASE);
    }

    /** 案件模式的分析結果，或合約模式的 contract／findings／compliance／revised（graph 兩模式共用）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Result(BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                         List<DraftedDocument> documents, GraphData graph,
                         ContractBrainstorm contract, ClauseFindings findings, ComplianceReport compliance,
                         RevisedClauses revised) {
        /** 相容既有呼叫端：案件模式。 */
        public Result(BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                      List<DraftedDocument> documents, GraphData graph) {
            this(brainstorm, research, analysis, assessment, documents, graph, null, null, null, null);
        }

        /** 相容 M1 呼叫端：合約模式但無 revised。 */
        public Result(BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                      List<DraftedDocument> documents, GraphData graph,
                      ContractBrainstorm contract, ClauseFindings findings, ComplianceReport compliance) {
            this(brainstorm, research, analysis, assessment, documents, graph, contract, findings, compliance, null);
        }
    }

    /** FAILED 時的錯誤代碼、訊息與步驤。 */
    public record ErrorInfo(String code, String message, String step) {}
}
