package tw.lawgraph.domain;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 建圖後的四條硬規則；純函式，不依賴 prompt。 */
public final class GraphRules {
    private GraphRules() {}

    /** 渲染器認得的節點群組白名單（superset 配色與篩選器依此）；其餘一律視為無效。 */
    static final Set<String> VALID_GROUPS = Set.of(
            "fact", "law", "judgment", "issue", "party", "plaintiff", "evidence",
            "contract", "clause", "obligation", "element");

    /**
     * 規則四：group 缺漏或不在白名單時，先嘗試以 ref／jid 對應檢索結果推斷為 law／judgment；
     * 推斷不出回 null（呼叫端移除）。小模型常整批漏填 group，前端會顯示 undefined。
     */
    private static GraphNode normalizeGroup(GraphNode node, Set<String> lawRefs, Set<String> judgmentIds) {
        if (node.group() != null && VALID_GROUPS.contains(node.group())) return node;
        String inferred = node.ref() != null && lawRefs.contains(node.ref()) ? "law"
                : node.jid() != null && judgmentIds.contains(node.jid()) ? "judgment" : null;
        if (inferred == null) return null;
        return new GraphNode(node.id(), inferred, node.label(), node.description(), node.ref(), node.jid(), node.met(),
                node.status(), node.url(), node.family(), node.favorable(), node.risk(), node.duty(), node.role());
    }

    /** 套用群組白名單、檢索錨定、涵攝覆寫與連線白名單，回傳過濾後的圖與紀錄。 */
    public static GraphOutcome apply(GraphData raw, ResearchResult research, AnalysisResult analysis) {
        List<String> notes = new ArrayList<>();
        Set<String> lawRefs = research.laws().stream().map(LawRef::ref).collect(Collectors.toSet());
        Set<String> judgmentIds = research.judgments().stream().map(JudgmentRef::jid).collect(Collectors.toSet());
        Map<String, Met> metByElement = new HashMap<>();
        for (var finding : analysis.elements()) {
            metByElement.put(finding.element(), finding.met());
        }

        List<GraphNode> nodes = new ArrayList<>();
        for (var originalNode : raw.nodes()) {
            GraphNode node = normalizeGroup(originalNode, lawRefs, judgmentIds);
            if (node == null) {
                notes.add("removed node without valid group: " + originalNode.label() + " (group=" + originalNode.group() + ")");
                continue;
            }
            if ("law".equals(node.group()) && (node.ref() == null || !lawRefs.contains(node.ref()))) {
                notes.add("removed unverified law node: " + node.label());
                continue;
            }
            if ("judgment".equals(node.group()) && (node.jid() == null || !judgmentIds.contains(node.jid()))) {
                notes.add("removed unverified judgment node: " + node.label());
                continue;
            }
            if ("element".equals(node.group())) {
                Met met = metByElement.get(node.label());
                node = new GraphNode(node.id(), node.group(), node.label(), node.description(), node.ref(), node.jid(),
                        met == null ? null : met.name(), node.status(), node.url(), node.family(), node.favorable(),
                        node.risk(), node.duty(), node.role());
            }
            nodes.add(node);
        }

        Set<String> nodeIds = nodes.stream().map(GraphNode::id).collect(Collectors.toCollection(HashSet::new));
        List<GraphEdge> edges = new ArrayList<>();
        for (var edge : raw.edges()) {
            boolean valid = EdgeLabel.isValid(edge.label())
                    && nodeIds.contains(edge.from())
                    && nodeIds.contains(edge.to());
            if (valid) {
                edges.add(edge);
            } else {
                notes.add("removed edge: " + edge.from() + "->" + edge.to() + " (" + edge.label() + ")");
            }
        }
        return new GraphOutcome(new GraphData(nodes, edges), notes);
    }
}
