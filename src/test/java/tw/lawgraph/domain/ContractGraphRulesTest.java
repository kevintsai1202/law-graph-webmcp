package tw.lawgraph.domain;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class ContractGraphRulesTest {
    private final ResearchResult research = new ResearchResult(List.of(new LawRef("勞動基準法第24條", "", "", "")), List.of(), List.of());
    private final ComplianceReport report = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(
            new ClauseFinding("第二條", "不發加班費", Risk.high, List.of("勞動基準法第24條"), "違反強行規定", "依法給付", List.of())), List.of(), null);
    private static GraphNode node(String id, String group, String label) {
        return new GraphNode(id, group, label, null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test void overridesClauseRiskAndDescriptionFromFindings() {
        var raw = new GraphData(List.of(node("c", "contract", "勞動契約"), node("cl1", "clause", "第二條 加班費"), node("l1", "law", "勞基法 24").withRef("勞動基準法第24條")),
                List.of(new GraphEdge("c", "cl1", "包含", null, null), new GraphEdge("cl1", "l1", "適用", null, null)));
        var out = ContractGraphRules.apply(raw, research, report);
        var clause = out.graph().nodes().stream().filter(n -> "clause".equals(n.group())).findFirst().orElseThrow();
        assertEquals("high", clause.risk());
        assertTrue(clause.description().contains("不發加班費") && clause.description().contains("依法給付"));
        assertEquals(2, out.graph().edges().size());
    }

    @Test void unmatchedClauseStaysNeutral() {
        var raw = new GraphData(List.of(node("cl9", "clause", "第九條 其他")), List.of());
        var clause = ContractGraphRules.apply(raw, research, report).graph().nodes().getFirst();
        assertNull(clause.risk());
    }

    @Test void boundaryAwareMatchPicksExactClauseNotSuffixedVariant() {
        var findingHigh = new ClauseFinding("第1條", "加班費不發", Risk.high, List.of(), "違反強行規定", "依法給付", List.of());
        var findingLow = new ClauseFinding("第1條之1", "補休換算", Risk.low, List.of(), "換算基準不明", "補充換算式", List.of());
        var report2 = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(findingHigh, findingLow), List.of(), null);
        var raw = new GraphData(List.of(node("cl1", "clause", "第1條 加班費"), node("cl2", "clause", "第1條之1 補休")), List.of());
        var out = ContractGraphRules.apply(raw, research, report2);
        var byId = out.graph().nodes().stream().collect(java.util.stream.Collectors.toMap(GraphNode::id, n -> n));
        assertEquals("high", byId.get("cl1").risk());
        assertEquals("low", byId.get("cl2").risk());
    }

    @Test void subClauseNumberIsAttributedToParentClause() {
        var findingHigh = new ClauseFinding("第1條", "加班費不發", Risk.high, List.of(), "違反強行規定", "依法給付", List.of());
        var report3 = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(findingHigh), List.of(), null);
        var raw = new GraphData(List.of(node("cl1", "clause", "第1條第2項 例外")), List.of());
        var clause = ContractGraphRules.apply(raw, research, report3).graph().nodes().stream()
                .filter(n -> "clause".equals(n.group())).findFirst().orElseThrow();
        assertEquals("high", clause.risk());
    }

    @Test void similarClauseNumberDoesNotMatch() {
        var findingHigh = new ClauseFinding("第1條", "加班費不發", Risk.high, List.of(), "違反強行規定", "依法給付", List.of());
        var report3 = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(findingHigh), List.of(), null);
        var raw = new GraphData(List.of(node("cl10", "clause", "第10條")), List.of());
        var clause = ContractGraphRules.apply(raw, research, report3).graph().nodes().stream()
                .filter(n -> "clause".equals(n.group())).findFirst().orElseThrow();
        assertNull(clause.risk());
    }

    @Test void missingClausesAreSynthesised() {
        var raw = new GraphData(List.of(node("c", "contract", "勞動契約")), List.of());
        var out = ContractGraphRules.apply(raw, research, report);
        assertTrue(out.graph().nodes().stream().anyMatch(n -> "clause".equals(n.group()) && "high".equals(n.risk())));
        assertTrue(out.graph().edges().stream().anyMatch(e -> "包含".equals(e.label())));
        assertTrue(out.notes().stream().anyMatch(n -> n.contains("synthesised")));
    }

    /** 逐 finding 合成：模型只畫 3 個 clause、findings 有 7 個 → 補 4 個，皆有 risk 且 id 不重複。 */
    @Test void synthesisesOnlyMissingClausesPerFinding() {
        var findings = new java.util.ArrayList<ClauseFinding>();
        for (int i = 1; i <= 7; i++) {
            findings.add(new ClauseFinding("第" + i + "條", "原文" + i, Risk.high, List.of(), "風險" + i, "建議" + i, List.of()));
        }
        var report7 = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, findings, List.of(), null);
        // 既有節點刻意佔用 clause-4／clause-5／clause-6 這些 id，用以驗證合成時的 id 去重
        var raw = new GraphData(List.of(node("c", "contract", "勞動契約"),
                node("clause-4", "clause", "第1條 加班費"), node("clause-5", "clause", "第2條 工時"), node("clause-6", "clause", "第3條 休假")),
                List.of());
        var out = ContractGraphRules.apply(raw, research, report7);
        var clauses = out.graph().nodes().stream().filter(n -> "clause".equals(n.group())).toList();
        assertEquals(7, clauses.size(), "3 個既有＋4 個合成");
        assertTrue(clauses.stream().allMatch(n -> "high".equals(n.risk())), "每個條款節點都應帶 risk");
        assertEquals(7, clauses.stream().map(GraphNode::id).distinct().count(), "id 不得重複");
        assertEquals(4, out.graph().edges().stream().filter(e -> "包含".equals(e.label())).count());
        assertTrue(out.notes().stream().anyMatch(n -> n.contains("synthesised 4 of 7 clause nodes")), out.notes().toString());
        assertTrue(out.notes().stream().anyMatch(n -> n.contains("obligation")), "應說明合成節點缺 obligation 層");
    }

    /** 全部 finding 都已有對應節點時不合成、不加 note。 */
    @Test void noSynthesisWhenAllFindingsMatched() {
        var raw = new GraphData(List.of(node("c", "contract", "勞動契約"), node("cl1", "clause", "第二條 加班費")), List.of());
        var out = ContractGraphRules.apply(raw, research, report);
        assertEquals(1, out.graph().nodes().stream().filter(n -> "clause".equals(n.group())).count());
        assertTrue(out.notes().stream().noneMatch(n -> n.contains("synthesised")));
    }
}
