package tw.lawgraph.domain;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 建圖後的三條硬規則；純函式，不依賴 prompt。 */
public final class GraphRules {
    private GraphRules() {}

    /** 套用檢索錨定、涵攝覆寫與連線白名單，回傳過濾後的圖與紀錄。 */
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
            GraphNode node = originalNode;
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
