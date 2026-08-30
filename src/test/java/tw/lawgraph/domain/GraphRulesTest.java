package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 三條硬規則：檢索錨定、涵攝單一來源、連線白名單。 */
class GraphRulesTest {
    private final ResearchResult research = new ResearchResult(
            List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "...", "law.moj.gov.tw")),
            List.of(new JudgmentRef("TPSV,108,台上,2345", "最高法院108年度台上字第2345號", "最高法院",
                    "2019-05-01", "...", null)),
            List.of());
    private final AnalysisResult analysis = new AnalysisResult(
            List.of(new ElementFinding("民法第184條第1項", "相當因果關係", Met.unknown, "通說", "未見行車紀錄")),
            "strategy", List.of(), "disclaimer");

    /** 建立測試用節點並省略無關欄位。 */
    private static GraphNode node(String id, String group, String label, String ref, String jid, String met) {
        return new GraphNode(id, group, label, null, ref, jid, met, null, null, null, null, null, null, null);
    }

    /** 未出現在檢索結果的法條與裁判節點及其連線必須移除。 */
    @Test
    void rule1RemovesLawAndJudgmentNodesNotInResearch() {
        var raw = new GraphData(List.of(
                node("l1", "law", "Civil Code Art. 184 ¶1（民法第184條第1項）", "民法第184條第1項", null, null),
                node("l2", "law", "Civil Code Art. 999（民法第999條）", "民法第999條", null, null),
                node("j1", "judgment", "Supreme Court 108-Tai-Shang-2345", null, "TPSV,108,台上,2345", null),
                node("j2", "judgment", "Hallucinated", null, "FAKE,1,1,1", null)),
                List.of(new GraphEdge("j2", "l1", "引用", null, null)));
        var outcome = GraphRules.apply(raw, research, analysis);
        var ids = outcome.graph().nodes().stream().map(GraphNode::id).toList();
        assertEquals(List.of("l1", "j1"), ids);
        assertTrue(outcome.graph().edges().isEmpty(), "連到被移除節點的邊也要移除");
        assertEquals(2, outcome.notes().stream().filter(note -> note.startsWith("removed unverified")).count());
    }

    /** element 的 met 必須完全取自 AnalysisResult。 */
    @Test
    void rule2OverridesMetFromAnalysisOnly() {
        var raw = new GraphData(List.of(
                node("e1", "element", "相當因果關係", null, null, "yes"),
                node("e2", "element", "不存在的要件", null, null, "yes")), List.of());
        var outcome = GraphRules.apply(raw, research, analysis);
        assertEquals("unknown", outcome.graph().nodes().get(0).met());
        assertNull(outcome.graph().nodes().get(1).met(), "涵攝表沒有的要件不得保留模型自填的 met");
    }

    /** 非白名單標籤與端點不存在的邊必須移除。 */
    @Test
    void rule3DropsInvalidLabelsAndDanglingEdges() {
        var raw = new GraphData(
                List.of(node("f1", "fact", "A", null, null, null),
                        node("i1", "issue", "B", null, null, null)),
                List.of(new GraphEdge("f1", "i1", "抗辯/阻斷", null, null),
                        new GraphEdge("f1", "i1", "relates to", null, null),
                        new GraphEdge("f1", "ghost", "適用", null, null)));
        var outcome = GraphRules.apply(raw, research, analysis);
        assertEquals(1, outcome.graph().edges().size());
        assertEquals(2, outcome.notes().stream().filter(note -> note.startsWith("removed edge")).count());
    }

    /** 規則四：group 缺漏或不在白名單的節點不得放行；能以 ref／jid 對應檢索結果者推斷為 law／judgment，其餘移除並記錄。 */
    @Test
    void rule4DropsNodesWithMissingOrUnknownGroupUnlessInferable() {
        var raw = new GraphData(List.of(
                node("n1", null, "Civil Code Art. 184 ¶1（民法第184條第1項）", "民法第184條第1項", null, null),
                node("n2", null, "Supreme Court 108-Tai-Shang-2345", null, "TPSV,108,台上,2345", null),
                node("n3", null, "闖紅燈", null, null, null),
                node("n4", "Fact", "大小寫錯誤的群組", null, null, null),
                node("f1", "fact", "正常事實", null, null, null)),
                List.of(new GraphEdge("n3", "f1", "適用", null, null)));
        var outcome = GraphRules.apply(raw, research, analysis);
        var byId = outcome.graph().nodes().stream().collect(java.util.stream.Collectors.toMap(GraphNode::id, n -> n));
        assertEquals(java.util.Set.of("n1", "n2", "f1"), byId.keySet());
        assertEquals("law", byId.get("n1").group(), "有 ref 對應檢索法條者推斷為 law");
        assertEquals("judgment", byId.get("n2").group(), "有 jid 對應檢索判決者推斷為 judgment");
        assertTrue(outcome.graph().edges().isEmpty(), "連到被移除節點的邊也要移除");
        assertEquals(2, outcome.notes().stream().filter(note -> note.startsWith("removed node without valid group")).count());
    }
}
