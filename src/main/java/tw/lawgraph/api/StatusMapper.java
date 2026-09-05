package tw.lawgraph.api;

import tw.lawgraph.domain.DraftedDocument;
import tw.lawgraph.domain.ResearchResult;

import java.util.ArrayList;
import java.util.List;

/** 把 Embabel 流程狀態換成前端契約 CaseStatus。 */
public final class StatusMapper {
    private StatusMapper() {}

    /** 依流程狀態與 blackboard 產物建立 CaseStatus；合約模式走 mapContract。 */
    public static CaseStatus map(StatusSnapshot snapshot) {
        if (snapshot.isContract()) return mapContract(snapshot);
        String step = deriveStep(snapshot);
        switch (snapshot.code()) {
            case COMPLETED -> {
                if (snapshot.outcome() != null) {
                    List<String> notes = new ArrayList<>(snapshot.research().notes());
                    notes.addAll(snapshot.outcome().notes());
                    var research = new ResearchResult(snapshot.research().laws(), snapshot.research().judgments(), notes,
                            snapshot.research().coverage(), snapshot.research().evidence());
                    return new CaseStatus(snapshot.caseId(), "COMPLETED", "GRAPH", snapshot.locale().code(), null,
                            new CaseStatus.Result(snapshot.brainstorm(), research, snapshot.analysis(), snapshot.assessment(),
                                    documents(snapshot), snapshot.outcome().graph()), null);
                }
                return failed(snapshot, "COMPLETED_WITHOUT_GRAPH", "process completed without a graph", step);
            }
            case WAITING -> {
                return new CaseStatus(snapshot.caseId(), "WAITING", "QUESTIONS", snapshot.locale().code(),
                        snapshot.pendingQuestions(), partial(snapshot), null);
            }
            case FAILED, TERMINATED, KILLED, STUCK -> {
                String message = snapshot.failure() == null
                        ? "agent process " + snapshot.code().name().toLowerCase()
                        : snapshot.failure();
                String code = snapshot.failureCode() == null ? snapshot.code().name() : snapshot.failureCode();
                return failed(snapshot, code, message, step);
            }
            default -> {
                return new CaseStatus(snapshot.caseId(), "RUNNING", step, snapshot.locale().code(), null,
                        partial(snapshot), null);
            }
        }
    }

    /** 合約模式：COMPLETED 需有 ComplianceReport 與 outcome（M2 起圖為必要產物），否則視為失敗；成功一律以 GRAPH 為步驤。 */
    private static CaseStatus mapContract(StatusSnapshot s) {
        String step = deriveStep(s);
        switch (s.code()) {
            case COMPLETED -> {
                if (s.compliance() == null) return failed(s, "COMPLETED_WITHOUT_REPORT", "process completed without a compliance report", step);
                if (s.outcome() == null) return failed(s, "COMPLETED_WITHOUT_GRAPH", "process completed without a graph", step);
                List<String> notes = new ArrayList<>(s.research() == null ? List.of() : s.research().notes());
                notes.addAll(s.outcome().notes());
                ResearchResult research = s.research() == null ? null : s.research().withNotes(notes);
                return new CaseStatus(s.caseId(), "COMPLETED", "GRAPH", s.locale().code(), null,
                        new CaseStatus.Result(null, research, null, null, null, s.outcome().graph(),
                                s.contract(), s.findings(), s.compliance(), s.revised()), null, CaseMode.CONTRACT);
            }
            case WAITING -> {
                return new CaseStatus(s.caseId(), "WAITING", "QUESTIONS", s.locale().code(), s.pendingQuestions(), partialContract(s), null, CaseMode.CONTRACT);
            }
            case FAILED, TERMINATED, KILLED, STUCK -> {
                String message = s.failure() == null ? "agent process " + s.code().name().toLowerCase() : s.failure();
                String code = s.failureCode() == null ? s.code().name() : s.failureCode();
                return failed(s, code, message, step);
            }
            default -> {
                return new CaseStatus(s.caseId(), "RUNNING", step, s.locale().code(), null, partialContract(s), null, CaseMode.CONTRACT);
            }
        }
    }

    /** 進行中／等待時的中間成果：已完成步驟的產物逐段公開，圖一律為 null；尚無任何產物則回 null。 */
    static CaseStatus.Result partial(StatusSnapshot snapshot) {
        if (snapshot.brainstorm() == null && snapshot.research() == null && snapshot.analysis() == null
                && snapshot.assessment() == null) return null;
        return new CaseStatus.Result(snapshot.brainstorm(), snapshot.research(), snapshot.analysis(),
                snapshot.assessment(), documents(snapshot), null);
    }

    /** 合約模式中間成果：已產出的 contract／research／findings／revised 逐段公開；尚無任何產物則回 null。 */
    static CaseStatus.Result partialContract(StatusSnapshot s) {
        if (s.contract() == null && s.research() == null && s.findings() == null) return null;
        return new CaseStatus.Result(null, s.research(), null, null, null, null, s.contract(), s.findings(), s.compliance(), s.revised());
    }

    /** 已起草的書狀清單；draftDocuments 尚未執行時為 null。 */
    private static List<DraftedDocument> documents(StatusSnapshot snapshot) {
        return snapshot.documents() == null ? null : snapshot.documents().documents();
    }

    /** 依 blackboard 已產生的最後成果推導目前步驤；兩模式各一套。 */
    static String deriveStep(StatusSnapshot snapshot) {
        if (snapshot.isContract()) {
            if (snapshot.compliance() != null || snapshot.revised() != null) return "GRAPH";
            if (snapshot.findings() != null) return "SUMMARY";
            if (snapshot.research() != null) return "REVIEW";
            if (snapshot.answers() != null) return "RESEARCH";
            if (snapshot.contract() != null) return "QUESTIONS";
            return "LOAD";
        }
        if (snapshot.documents() != null) return "GRAPH";
        if (snapshot.assessment() != null) return "DOCUMENTS";
        if (snapshot.analysis() != null) return "ASSESSMENT";
        if (snapshot.research() != null) return "ANALYSIS";
        if (snapshot.answers() != null) return "RESEARCH";
        if (snapshot.brainstorm() != null) return "QUESTIONS";
        return "BRAINSTORM";
    }

    /** 建立統一的失敗狀態，帶上快照的模式。 */
    private static CaseStatus failed(StatusSnapshot snapshot, String code, String message, String step) {
        return new CaseStatus(snapshot.caseId(), "FAILED", step, snapshot.locale().code(), null, null,
                new CaseStatus.ErrorInfo(code, message, step), snapshot.mode());
    }
}
