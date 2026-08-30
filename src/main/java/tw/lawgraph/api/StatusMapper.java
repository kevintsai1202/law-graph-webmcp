package tw.lawgraph.api;

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
                    var research = new ResearchResult(snapshot.research().laws(), snapshot.research().judgments(), notes);
                    return new CaseStatus(snapshot.caseId(), "COMPLETED", "GRAPH", snapshot.locale().code(), null,
                            new CaseStatus.Result(snapshot.brainstorm(), research, snapshot.analysis(),
                                    snapshot.outcome().graph()), null);
                }
                return failed(snapshot, "COMPLETED_WITHOUT_GRAPH", "process completed without a graph", step);
            }
            case WAITING -> {
                return new CaseStatus(snapshot.caseId(), "WAITING", "QUESTIONS", snapshot.locale().code(),
                        snapshot.pendingQuestions(), null, null);
            }
            case FAILED, TERMINATED, KILLED, STUCK -> {
                String message = snapshot.failure() == null
                        ? "agent process " + snapshot.code().name().toLowerCase()
                        : snapshot.failure();
                return failed(snapshot, snapshot.code().name(), message, step);
            }
            default -> {
                return new CaseStatus(snapshot.caseId(), "RUNNING", step, snapshot.locale().code(), null, null, null);
            }
        }
    }

    /** 依 blackboard 已產生的最後成果推導目前步驟。 */
    static String deriveStep(StatusSnapshot snapshot) {
        if (snapshot.analysis() != null) return "GRAPH";
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
