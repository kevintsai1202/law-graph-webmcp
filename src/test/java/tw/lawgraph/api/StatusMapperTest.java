package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.AnalysisResult;
import tw.lawgraph.domain.BrainstormResult;
import tw.lawgraph.domain.GraphData;
import tw.lawgraph.domain.GraphOutcome;
import tw.lawgraph.domain.Locale;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.ResearchResult;
import tw.lawgraph.domain.UserAnswers;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/** CaseStatus 的狀態與步驟推導契約測試。 */
class StatusMapperTest {
    private final BrainstormResult brainstorm = new BrainstormResult(List.of(), List.of(), List.of(), List.of(),
            List.of(new Question("q1", "?", "why")));
    private final ResearchResult research = new ResearchResult(List.of(), List.of(),
            List.of("semantic search unavailable"));
    private final AnalysisResult analysis = new AnalysisResult(List.of(), "", List.of(), "");
    private final GraphOutcome graph = new GraphOutcome(new GraphData(List.of(), List.of()),
            List.of("removed edge: x->y (bad)"));

    /** 建立測試快照。 */
    private StatusSnapshot snapshot(AgentProcessStatusCode code, BrainstormResult b, List<Question> questions,
                                    UserAnswers answers, ResearchResult r, AnalysisResult a, GraphOutcome g) {
        return new StatusSnapshot("c1", Locale.EN, code, b, questions, answers, r, a, g, null);
    }

    /** 尚無產物時為頭腦風暴。 */
    @Test void runningBeforeBrainstorm() {
        var status = StatusMapper.map(snapshot(AgentProcessStatusCode.RUNNING, null, null, null, null, null, null));
        assertEquals("RUNNING", status.status()); assertEquals("BRAINSTORM", status.step()); assertNull(status.result());
    }

    /** 等待狀態只公開待答問題。 */
    @Test void waitingExposesQuestions() {
        var status = StatusMapper.map(snapshot(AgentProcessStatusCode.WAITING, brainstorm, brainstorm.questions(),
                null, null, null, null));
        assertEquals("WAITING", status.status()); assertEquals("QUESTIONS", status.step());
        assertEquals(1, status.questions().size());
    }

    /** 回答完成後進入檢索。 */
    @Test void runningAfterAnswersIsResearchStep() {
        var status = StatusMapper.map(snapshot(AgentProcessStatusCode.RUNNING, brainstorm, null,
                new UserAnswers(List.of()), null, null, null));
        assertEquals("RESEARCH", status.step());
    }

    /** 完成時合併研究與硬規則附註。 */
    @Test void completedMergesNotes() {
        var status = StatusMapper.map(snapshot(AgentProcessStatusCode.COMPLETED, brainstorm, null,
                new UserAnswers(List.of()), research, analysis, graph));
        assertEquals("COMPLETED", status.status()); assertEquals("GRAPH", status.step());
        assertEquals(List.of("semantic search unavailable", "removed edge: x->y (bad)"),
                status.result().research().notes()); assertNotNull(status.result().graph());
    }

    /** 失敗狀態保留當前推導步驟。 */
    @Test void failedCarriesStep() {
        var snapshot = new StatusSnapshot("c1", Locale.EN, AgentProcessStatusCode.FAILED, brainstorm, null,
                new UserAnswers(List.of()), research, null, null, "boom");
        var status = StatusMapper.map(snapshot);
        assertEquals("FAILED", status.status()); assertEquals("ANALYSIS", status.error().step());
        assertEquals("boom", status.error().message());
    }
}
