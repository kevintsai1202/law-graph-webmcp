package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.ClarificationAssessment;
import tw.lawgraph.domain.Question;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 兩個 Agent 共用的澄清防禦邏輯。 */
class ClarificationSupportTest {
    @Test void sufficientOrNullQuestionsYieldNone() {
        assertEquals(List.of(), ClarificationSupport.safeQuestions(null));
        assertEquals(List.of(), ClarificationSupport.safeQuestions(new ClarificationAssessment(true, List.of(new Question("a", "b", "c")), null)));
    }
    @Test void questionsCappedAtFiveAndGapsDeduplicated() {
        var qs = java.util.stream.IntStream.range(0, 7).mapToObj(i -> new Question("q" + i, "t", "w")).toList();
        var a = new ClarificationAssessment(false, qs, java.util.Arrays.asList("g", "g", " ", null));
        assertEquals(5, ClarificationSupport.safeQuestions(a).size());
        assertEquals(List.of("g"), ClarificationSupport.safeGaps(a));
    }
    @Test void unavailableAnswersDetectedInBothLanguages() {
        assertTrue(ClarificationSupport.isUnavailable(null));
        assertTrue(ClarificationSupport.isUnavailable("我不清楚"));
        assertTrue(ClarificationSupport.isUnavailable("Not Sure"));
        assertFalse(ClarificationSupport.isUnavailable("2026-09-01 簽約"));
    }
}
