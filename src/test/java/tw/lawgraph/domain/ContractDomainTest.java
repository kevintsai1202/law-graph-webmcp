package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 合約領域 record 的正規化契約：白名單、順序、null 兜底。 */
class ContractDomainTest {
    @Test void contractInputNormalizesPartyScopesOutputsAndModel() {
        var input = new ContractInput("  合約全文  ", Locale.ZH_TW, "  partyB ", List.of("labor", "bogus", "commercial", "labor"),
                List.of("graph", "revised", "revised"), " gpt-5.4-nano ");
        assertEquals("合約全文", input.text());
        assertEquals("partyB", input.party());
        assertEquals(List.of("commercial", "labor"), input.scopes());
        assertEquals(List.of("revised"), input.outputs());
        assertTrue(input.wantsRevised());
        assertTrue(input.hasModelOverride());
        assertEquals("gpt-5.4-nano", input.model());
    }

    @Test void contractInputDefaultsUnknownPartyAndEmptyLists() {
        var input = new ContractInput("x", Locale.EN, "landlord", null, null, null);
        assertEquals("unknown", input.party());
        assertEquals(List.of(), input.scopes());
        assertFalse(input.wantsRevised());
        assertFalse(input.hasModelOverride());
    }

    @Test void contractScopesExposeOrderAndTitles() {
        assertEquals(List.of("commercial", "labor", "privacy", "corporate"), ContractScopes.CODES);
        assertEquals("勞動契約（勞動基準法）", ContractScopes.chineseTitle("labor"));
        assertEquals("", ContractScopes.chineseTitle("nope"));
    }

    @Test void brainstormAndFindingsTolerateNulls() {
        var brainstorm = new ContractBrainstorm(null, null, null, null, null, null);
        assertEquals("", brainstorm.contractType());
        assertEquals(List.of(), brainstorm.clauses());
        assertEquals(List.of(), brainstorm.questions());
        var finding = new ClauseFinding("第3條", "text", null, null, null, null, null);
        assertEquals(Risk.medium, finding.risk());
        assertEquals(List.of(), finding.lawRefs());
        assertEquals("", finding.riskPoint());
        var findings = new ClauseFindings(null, null);
        assertEquals(List.of(), findings.findings());
        var report = new ComplianceReport(null, null, null, List.of(finding), null, null);
        assertEquals(Risk.medium, report.overallRisk());
        assertEquals(ComplianceReport.DEFAULT_DISCLAIMER, report.disclaimer());
    }

    @Test void complianceReportOverallRiskIsHighestFinding() {
        var low = new ClauseFinding("1", "", Risk.low, List.of(), "", "", List.of());
        var high = new ClauseFinding("2", "", Risk.high, List.of(), "", "", List.of());
        assertEquals(Risk.high, ComplianceReport.highest(List.of(low, high)));
        assertEquals(Risk.low, ComplianceReport.highest(List.of(low)));
        assertEquals(Risk.low, ComplianceReport.highest(List.of()));
    }
}
