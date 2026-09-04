package tw.lawgraph.api;

import tw.lawgraph.domain.DraftedDocument;
import tw.lawgraph.domain.ResearchResult;

import java.util.ArrayList;
import java.util.List;

/** 把 Embabel 流程狀態換成前端契約 CaseStatus。 */
public final class StatusMapper {
    private StatusMapper() {}

    /** 依流程狀態與 blackboard 產物建立 CaseStatus。 */
    public static CaseStatus map(StatusSnapshot snapshot) {
        String step = deriveStep(snapshot);
        switch (snapshot.code()) {
            case COMPLETED -> {
                if (snapshot.outcome() != null) {
                    List<String> notes = new ArrayList<>(snapshot.research().notes());
                    notes.addAll(snapshot.outcome().notes());
                    var research = new ResearchResult(snapshot.research().laws(), snapshot.research().judgments(), notes,
                            snapshot.research().coverage(), snapshot.research().evidence());
                    return new CaseStatus(snapshot.caseId(), "COMPLETED", "GRAPH", snapshot.locale().code(), null,
                            new CaseStatus.Result(snapshot.brainstorm(), research, snapshot.analysis(),
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

    /** 進行中／等待時的中間成果：已完成步驟的產物逐段公開，圖一律為 null；尚無任何產物則回 null。 */
    static CaseStatus.Result partial(StatusSnapshot snapshot) {
        if (snapshot.brainstorm() == null && snapshot.research() == null && snapshot.analysis() == null) return null;
        return new CaseStatus.Result(snapshot.brainstorm(), snapshot.research(), snapshot.analysis(),
                documents(snapshot), null);
    }

    /** 已起草的書狀清單；draftDocuments 尚未執行時為 null。 */
    private static List<DraftedDocument> documents(StatusSnapshot snapshot) {
        return snapshot.documents() == null ? null : snapshot.documents().documents();
    }

    /** 依 blackboard 已產生的最後成果推導目前步驟。 */
    static String deriveStep(StatusSnapshot snapshot) {
        if (snapshot.documents() != null) return "GRAPH";
        if (snapshot.analysis() != null) return "DOCUMENTS";
        if (snapshot.research() != null) return "ANALYSIS";
        if (snapshot.answers() != null) return "RESEARCH";
        if (snapshot.brainstorm() != null) return "QUESTIONS";
        return "BRAINSTORM";
    }

    /** 建立統一的失敗狀態。 */
    private static CaseStatus failed(StatusSnapshot snapshot, String code, String message, String step) {
        return new CaseStatus(snapshot.caseId(), "FAILED", step, snapshot.locale().code(), null, null,
                new CaseStatus.ErrorInfo(code, message, step));
    }
}
