package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.CaseAssessment;
import tw.lawgraph.domain.ClauseFindings;
import tw.lawgraph.domain.ComplianceReport;
import tw.lawgraph.domain.ContractBrainstorm;
import tw.lawgraph.domain.DraftedDocuments;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.RevisedClauses;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

/**
 * 從 AgentProcess blackboard 擷取的純資料快照。mode 決定讀哪組產物：案件流程用 brainstorm～outcome，
 * 合約流程用 contract／findings／compliance／revised（outcome 與 revised 於 M2 共用）。
 * failureCode 由應用層指定（例如 STEP_TIMEOUT）。
 */
public record StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                             BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                             ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                             DraftedDocuments documents, GraphOutcome outcome, String failure, String failureCode,
                             String mode, ContractBrainstorm contract, ClauseFindings findings, ComplianceReport compliance,
                             RevisedClauses revised) {
    /** 正規化 mode，未知一律視為案件模式。 */
    public StatusSnapshot { mode = CaseMode.normalize(mode); }

    /** 相容既有呼叫端：案件模式、無合約產物。 */
    public StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                          BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                          ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                          DraftedDocuments documents, GraphOutcome outcome, String failure, String failureCode) {
        this(caseId, locale, code, brainstorm, pendingQuestions, answers, research, analysis, assessment, documents, outcome,
                failure, failureCode, CaseMode.CASE, null, null, null, null);
    }

    /** 相容 M1 呼叫端：合約模式但無 revised（尚未支援修訂條款）。 */
    public StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                          BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                          ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                          DraftedDocuments documents, GraphOutcome outcome, String failure, String failureCode,
                          String mode, ContractBrainstorm contract, ClauseFindings findings, ComplianceReport compliance) {
        this(caseId, locale, code, brainstorm, pendingQuestions, answers, research, analysis, assessment, documents, outcome,
                failure, failureCode, mode, contract, findings, compliance, null);
    }

    /** 是否為合約審查流程。 */
    public boolean isContract() { return CaseMode.CONTRACT.equals(mode); }
}
