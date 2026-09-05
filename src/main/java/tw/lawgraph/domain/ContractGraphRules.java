package tw.lawgraph.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** 合約圖硬規則：以審查結果覆寫 clause 節點的 risk／description，補建缺漏條款節點，再套用共用 GraphRules。 */
public final class ContractGraphRules {
    private ContractGraphRules() {}

    /** 找出 clauseNo 對應的節點：id 相同或 label 包含 clauseNo。 */
    private static Optional<ClauseFinding> match(GraphNode node, List<ClauseFinding> findings) {
        return findings.stream().filter(f -> !f.clauseNo().isBlank()
                && (f.clauseNo().equals(node.id()) || (node.label() != null && node.label().contains(f.clauseNo())))).findFirst();
    }

    /** 「條款原文／風險點／修改建議」三段描述。 */
    static String describe(ClauseFinding f) {
        return "條款原文：" + f.clauseText() + "\n風險分析：" + f.riskPoint() + "\n修改建議：" + f.suggestion();
    }

    /** 覆寫 risk／description。 */
    private static GraphNode decorate(GraphNode n, ClauseFinding f) {
        return new GraphNode(n.id(), n.group(), n.label(), describe(f), n.ref(), n.jid(), n.met(), n.status(), n.url(),
                n.family(), n.favorable(), f.risk().name(), n.duty(), n.role());
    }

    /** 以審查結果為 clause 節點上色：先比對覆寫，再補建缺漏節點，最後套用共用白名單規則。 */
    public static GraphOutcome apply(GraphData raw, ResearchResult research, ComplianceReport report) {
        List<String> notes = new ArrayList<>();
        List<GraphNode> nodes = new ArrayList<>();
        List<GraphEdge> edges = new ArrayList<>(raw.edges());
        boolean hasClause = false;
        for (GraphNode n : raw.nodes()) {
            if ("clause".equals(n.group())) {
                hasClause = true;
                nodes.add(match(n, report.findings()).map(f -> decorate(n, f)).orElse(n));
            } else nodes.add(n);
        }
        if (!hasClause && !report.findings().isEmpty()) {
            String contractId = nodes.stream().filter(n -> "contract".equals(n.group())).map(GraphNode::id).findFirst().orElseGet(() -> {
                nodes.add(new GraphNode("contract", "contract", report.contractType(), null, null, null, null, null, null, null, null, null, null, null));
                return "contract";
            });
            int i = 0;
            for (ClauseFinding f : report.findings()) {
                String id = "clause-" + (++i);
                nodes.add(decorate(new GraphNode(id, "clause", f.clauseNo(), null, null, null, null, null, null, report.contractType(), null, null, null, null), f));
                edges.add(new GraphEdge(contractId, id, "包含", null, null));
            }
            notes.add("synthesised " + i + " clause nodes from the compliance report");
        }
        GraphOutcome filtered = GraphRules.apply(new GraphData(nodes, edges), research, new AnalysisResult(List.of(), "", List.of(), ""));
        notes.addAll(filtered.notes());
        return new GraphOutcome(filtered.graph(), notes);
    }
}
