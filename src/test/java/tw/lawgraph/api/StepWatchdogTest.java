package tw.lawgraph.api;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 步驤看門狗：同一步驤持續超過上限才算逾時，換步驤即重新計時。 */
class StepWatchdogTest {
    private final StepWatchdog watchdog = new StepWatchdog(Duration.ofSeconds(300));

    /** 未超過上限不逾時。 */
    @Test void notExceededWithinLimit() {
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 0));
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 299_000));
    }

    /** 同一步驤超過上限即逾時。 */
    @Test void exceededWhenSameStepOutlivesLimit() {
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 0));
        assertTrue(watchdog.exceeded("c1", "ANALYSIS", 300_001));
    }

    /** 步驤前進就重新計時。 */
    @Test void stepChangeResetsTimer() {
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 0));
        assertFalse(watchdog.exceeded("c1", "DOCUMENTS", 299_000));
        assertFalse(watchdog.exceeded("c1", "DOCUMENTS", 598_000));
        assertTrue(watchdog.exceeded("c1", "DOCUMENTS", 599_001));
    }

    /** 忘記案件後（例如等待回答）重新開始計時。 */
    @Test void forgetRestartsTimer() {
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 0));
        watchdog.forget("c1");
        assertFalse(watchdog.exceeded("c1", "ANALYSIS", 400_000));
        assertTrue(watchdog.exceeded("c1", "ANALYSIS", 700_001));
    }
}
