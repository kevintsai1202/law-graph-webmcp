package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** 合約審查產物也要經台灣用語守門。 */
class TaiwanTerminologyContractTest {
    @Test void sanitizesFindingsAndReport() {
        var finding = new ClauseFinding("第1條", "雙方當事人簽訂合同", Risk.high, List.of(), "合同無效", "改為契約", List.of());
        var cleaned = TaiwanTerminology.sanitize(new ClauseFindings(List.of(finding), List.of()));
        assertEquals("兩造簽訂契約", cleaned.findings().getFirst().clauseText());
        assertEquals("契約無效", cleaned.findings().getFirst().riskPoint());
        var report = TaiwanTerminology.sanitize(new ComplianceReport("合同", List.of(), Risk.low, List.of(finding), List.of("修改合同"), "x"));
        assertEquals("契約", report.contractType());
        assertEquals(List.of("修改契約"), report.priorities());
        assertEquals("契約無效", report.findings().getFirst().riskPoint());
    }
}
