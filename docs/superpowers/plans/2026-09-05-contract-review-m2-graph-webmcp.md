# 合約審查 M2：契約義務圖＋修訂條款＋WebMCP 工具＋判決輸贏方篩選 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合約流程補齊 REVISE（修訂版條款）與 GRAPH（contract→clause→obligation 三層圖，clause 依審查風險上色），WebMCP 新增六個能力／合約工具（16→22），判決關鍵字查詢支援 main_text 輸贏方篩選。

**Architecture:** ContractReviewAgent 的 goal 從 summarizeCompliance 移到 buildContractGraph；新增 reviseClauses（勾選才呼叫 LLM）與 buildContractGraph（LLM 出 GraphData，Java 以 findings 覆寫 clause.risk／description 再過 GraphRules）。前端結果頁補 doc-revised 面板與 graph 分頁，webmcp.js 加 HOME 狀態工具清單與合約工具。

**Tech Stack:** 同 M1。

**Spec:** `docs/superpowers/specs/2026-09-05-contract-review-branch-design.md`（§4.5 圖／修訂、§4.7、§5.1 REVISE／GRAPH、§5.4）

## Global Constraints

同 M1 計畫的 Global Constraints（JDK 21 前綴、npm test／bundle、i18n 鍵一致、中文註解、GOAP 分支放 Action 內、commit 尾註）。另：
- 工具名稱 ≤30 字、描述 ≤150 字、inputSchema `additionalProperties:false`（webmcp.test.mjs 守著）；工具總數測試改為 22。
- 前置：M1 計畫全部完成且 `mvn test`／`npm test` 綠燈。

---

## File Structure

**後端新增**
- `domain/RevisedClauses.java`（含 `RevisedClause` nested record）
- `domain/ContractGraphRules.java` — 以 findings 覆寫 clause 節點 risk／description
- 測試：`domain/ContractGraphRulesTest.java`、`agent/ContractReviewAgentGraphTest.java`、`research/mcp/McpTaiwanLegalDbAdapterMainTextTest.java`

**後端修改**
- `agent/ContractPrompts.java`（+`revise`、`graph`）、`agent/ContractReviewAgent.java`（+2 Action、goal 搬移）
- `api/StatusSnapshot.java`／`CaseStatus.java`／`StatusMapper.java`／`CaseService.java`（+revised）
- `research/ResearchPlan.java`（JudgmentKeywordQuery +mainText）、`research/mcp/McpTaiwanLegalDbAdapter.java`

**前端修改**
- `static/js/views/result.js`（doc-revised 面板、graph 圖例）、`static/js/graphView.js`（圖例加 contract 群組與 risk 說明）
- `static/js/webmcp.js`、`static/js/app.js`（getComplianceReport／filterFindingsByRisk／listCapabilities 對應函式）
- `frontend-tests/webmcp.test.mjs`、`views.test.mjs`、`app.test.mjs`；`e2e/smoke.spec.mjs`

---

### Task 1: RevisedClauses 型別、ContractPrompts.revise／graph

**Files:**
- Create: `src/main/java/tw/lawgraph/domain/RevisedClauses.java`
- Modify: `src/main/java/tw/lawgraph/agent/ContractPrompts.java`
- Test: `src/test/java/tw/lawgraph/domain/RevisedClausesTest.java`、`src/test/java/tw/lawgraph/agent/ContractPromptsTest.java`（新增兩個方法）

**Interfaces:**
- Produces: `RevisedClauses(List<RevisedClause> items)`；`RevisedClause(String clauseNo, String original, String revised, String rationale)`；`RevisedClauses.EMPTY`
- Produces: `ContractPrompts.revise(ContractInput, ContractBrainstorm, ComplianceReport)`、`ContractPrompts.graph(ContractInput, ContractBrainstorm, ResearchResult, ComplianceReport)`

- [ ] **Step 1: 測試**

```java
// RevisedClausesTest.java
package tw.lawgraph.domain;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class RevisedClausesTest {
    @Test void nullsBecomeEmpty() {
        assertEquals(List.of(), new RevisedClauses(null).items());
        var item = new RevisedClauses.RevisedClause(null, null, null, null);
        assertEquals("", item.clauseNo()); assertEquals("", item.revised());
        assertTrue(RevisedClauses.EMPTY.items().isEmpty());
    }
}
```
```java
// ContractPromptsTest 新增
    @Test void reviseTargetsHighAndMediumOnly() {
        var report = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(), List.of(), null);
        String p = ContractPrompts.revise(input, brainstorm, report);
        assertTrue(p.contains("RevisedClauses")); assertTrue(p.contains("high or medium"));
    }
    @Test void graphPromptRequiresContractGroupsAndRefs() {
        var report = new ComplianceReport("勞動契約", List.of("labor"), Risk.high, List.of(), List.of(), null);
        var research = new ResearchResult(List.of(), List.of(), List.of());
        String p = ContractPrompts.graph(input, brainstorm, research, report);
        assertTrue(p.startsWith("Activate skill \"legal-graph\""));
        assertTrue(p.contains("contract, clause, obligation")); assertTrue(p.contains("research.laws[].ref"));
        assertTrue(p.contains("包含")); assertTrue(p.contains("課予"));
    }
```

- [ ] **Step 2: 跑** — 編譯錯誤

- [ ] **Step 3: 實作**

`RevisedClauses.java`
```java
package tw.lawgraph.domain;
import java.util.List;
import java.util.Objects;
/** reviseClauses 的產物：高／中風險條款的修訂版對照。未勾選時為 EMPTY，不呼叫 LLM。 */
public record RevisedClauses(List<RevisedClause> items) {
    public static final RevisedClauses EMPTY = new RevisedClauses(List.of());
    public RevisedClauses { items = items == null ? List.of() : items.stream().filter(Objects::nonNull).toList(); }
    /** 一條修訂：條號、原文、修訂後條文、修改理由（引用法規依據）。 */
    public record RevisedClause(String clauseNo, String original, String revised, String rationale) {
        public RevisedClause {
            clauseNo = clauseNo == null ? "" : clauseNo.trim(); original = original == null ? "" : original;
            revised = revised == null ? "" : revised; rationale = rationale == null ? "" : rationale;
        }
    }
}
```

`ContractPrompts` 新增：
```java
    /** 修訂版條款：只針對 high／medium，保留原條號，理由引用白名單法規。 */
    public static String revise(ContractInput input, ContractBrainstorm brainstorm, ComplianceReport report) {
        return """
                Activate skill "compliance-verification" step 3 (修改建議) and produce replacement wording. Output only a RevisedClauses object.
                Our side: %s. Contract type: %s.
                <findings>%s</findings>
                For every finding with risk high or medium (skip low): items[] {clauseNo (copy), original (copy clauseText verbatim), revised (complete replacement clause text in formal Taiwan contract drafting register, ready to paste; keep the clause numbering style), rationale (one sentence citing the lawRefs of that finding verbatim; never cite anything else)}.
                Revised wording must protect our side while staying enforceable under Taiwan law; if the clause is void as a whole, replace it with a lawful clause that achieves the legitimate purpose. Taiwan legal terms only. Respond in %s.
                """.formatted(partyLabel(input.party()), brainstorm.contractType(), toJson(report), input.locale().code());
    }

    /** 契約義務關係圖：contract→clause→obligation 三層、當事人、法條；clause.risk 由伺服器覆寫。 */
    public static String graph(ContractInput input, ContractBrainstorm brainstorm, ResearchResult research, ComplianceReport report) {
        return """
                Activate skill "legal-graph" and build the contract obligation graph (契約→條款→義務三層模型). Output only the requested object (nodes, edges).
                <brainstorm>%s</brainstorm>
                <research>%s</research>
                <report>%s</report>
                Rules for this environment:
                - Node groups (lower-case, exactly one of): contract, clause, obligation, party, law, judgment. One contract node (label = contractType). One clause node per finding, label = clauseNo + short title, and set "family" to the contract label. One obligation node per duty a clause imposes ({duty: main|collateral|incidental}). One party node per brainstorm.parties entry with "role".
                - Do NOT set "risk" or "description" on clause nodes; the server fills them from the report.
                - Every law node must carry "ref" copied verbatim from research.laws[].ref; every judgment node "jid" from research.judgments[].jid. Unlisted ones are deleted.
                - Edge labels (Chinese, exact): 包含 (contract→clause), 課予 (clause→obligation), 負擔 (party→obligation, debtor), 得請求 (obligation→party, creditor), 對價 (obligation↔obligation), 違約效果 (clause→obligation), 適用 (contract/clause→law), 引用 (clause→judgment), 當事人 (party→contract). Use "from"/"to".
                - Write labels in %s; identifiers keep their original form.
                """.formatted(toJson(brainstorm), toJson(research), toJson(report), input.locale().code());
    }
```

- [ ] **Step 4: 跑** — `-Dtest='RevisedClausesTest,ContractPromptsTest'` PASS
- [ ] **Step 5: Commit** — `feat(agent): RevisedClauses 型別與修訂／建圖 prompt`

---

### Task 2: ContractGraphRules（findings → clause 節點 risk／description）

**Files:**
- Create: `src/main/java/tw/lawgraph/domain/ContractGraphRules.java`
- Test: `src/test/java/tw/lawgraph/domain/ContractGraphRulesTest.java`

**Interfaces:**
- Produces: `ContractGraphRules.apply(GraphData raw, ResearchResult research, ComplianceReport report) → GraphOutcome`：先以 clauseNo 比對（節點 label 含 clauseNo 或 node.id 等於 clauseNo）覆寫 `risk` 與 `description`（「條款原文／風險點／修改建議」三段），未匹配的 clause 節點不標 risk；再呼叫 `GraphRules.apply(raw, research, emptyAnalysis)` 過白名單；若圖中沒有任何 clause 節點但 report 有 findings，補建 contract 節點（若缺）與每條 clause 節點＋「包含」邊，記 note

- [ ] **Step 1: 測試**

```java
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

    @Test void missingClausesAreSynthesised() {
        var raw = new GraphData(List.of(node("c", "contract", "勞動契約")), List.of());
        var out = ContractGraphRules.apply(raw, research, report);
        assertTrue(out.graph().nodes().stream().anyMatch(n -> "clause".equals(n.group()) && "high".equals(n.risk())));
        assertTrue(out.graph().edges().stream().anyMatch(e -> "包含".equals(e.label())));
        assertTrue(out.notes().stream().anyMatch(n -> n.contains("synthesised")));
    }
}
```
（測試用到 `GraphNode.withRef`；若無此方法，改用 14 參數建構子直接填 ref，或在 GraphNode 加 `withRef(String)` 便利方法。）

- [ ] **Step 2: 跑** — 編譜錯誤

- [ ] **Step 3: 實作**

```java
package tw.lawgraph.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** 合約圖硬規則：以審查結果覆寫 clause 節點的 risk／description，補建缺漏條款節點，再套用共用 GraphRules。 */
public final class ContractGraphRules {
    private ContractGraphRules() {}

    /** 找出 clauseNo 對應的節點：id 相同或 label 以 clauseNo 開頭／包含。 */
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
```

- [ ] **Step 4: 跑** — PASS
- [ ] **Step 5: Commit** — `feat(domain): ContractGraphRules 以審查結果為條款節點上色`

---

### Task 3: Agent 加 reviseClauses／buildContractGraph，goal 搬到建圖

**Files:**
- Modify: `src/main/java/tw/lawgraph/agent/ContractReviewAgent.java`
- Test: `src/test/java/tw/lawgraph/agent/ContractReviewAgentGraphTest.java`

**Interfaces:**
- Produces: `reviseClauses(ContractInput, ContractBrainstorm, ComplianceReport, OperationContext) → RevisedClauses`（未勾 revised → EMPTY，零 LLM）
- Produces: `@AchievesGoal buildContractGraph(ContractInput, ContractBrainstorm, ResearchResult, ComplianceReport, RevisedClauses, OperationContext) → GraphOutcome`（RevisedClauses 參數確保修訂先於建圖）
- `summarizeCompliance` 移除 `@AchievesGoal`

- [ ] **Step 1: 測試**

```java
package tw.lawgraph.agent;
import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class ContractReviewAgentGraphTest {
    private final ContractReviewAgent agent = new ContractReviewAgent(new Skills("law-powers", "t"), null);
    private final ContractBrainstorm brainstorm = new ContractBrainstorm("勞動契約", List.of("labor"), List.of(), List.of(), List.of(), "");
    private final ResearchResult research = new ResearchResult(List.of(new LawRef("勞動基準法第24條", "", "", "")), List.of(), List.of());
    private final ComplianceReport report = new ComplianceReport("勞動契約", List.of("labor"), Risk.high,
            List.of(new ClauseFinding("第二條", "不發加班費", Risk.high, List.of("勞動基準法第24條"), "r", "s", List.of())), List.of(), null);

    @Test void reviseSkipsLlmWhenNotRequested() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of(), "");
        assertEquals(RevisedClauses.EMPTY, agent.reviseClauses(input, brainstorm, report, context));
        assertTrue(context.getLlmInvocations().isEmpty());
    }
    @Test void reviseCallsLlmWhenRequested() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of("revised"), "");
        var expected = new RevisedClauses(List.of(new RevisedClauses.RevisedClause("第二條", "o", "n", "依勞動基準法第24條")));
        context.expectResponse(expected);
        assertEquals(expected, agent.reviseClauses(input, brainstorm, report, context));
    }
    @Test void buildContractGraphColoursClauses() {
        var context = FakeOperationContext.create();
        var input = new ContractInput("x", Locale.ZH_TW, "partyB", List.of(), List.of(), "");
        context.expectResponse(new GraphData(List.of(
                new GraphNode("c", "contract", "勞動契約", null, null, null, null, null, null, null, null, null, null, null),
                new GraphNode("cl", "clause", "第二條 加班費", null, null, null, null, null, null, null, null, null, null, null)),
                List.of(new GraphEdge("c", "cl", "包含", null, null))));
        var out = agent.buildContractGraph(input, brainstorm, research, report, RevisedClauses.EMPTY, context);
        assertEquals("high", out.graph().nodes().stream().filter(n -> "clause".equals(n.group())).findFirst().orElseThrow().risk());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().startsWith("Activate skill \"legal-graph\""));
    }
}
```

- [ ] **Step 2: 跑** — 編譜錯誤

- [ ] **Step 3: 實作**（ContractReviewAgent 追加；`summarizeCompliance` 去掉 `@AchievesGoal`）

```java
    /** 步驤 REVISE：勾選 revised 才呼叫 LLM 產生高／中風險條款修訂版；否則回空、零成本。 */
    @Action
    public RevisedClauses reviseClauses(ContractInput input, ContractBrainstorm brainstorm, ComplianceReport report, OperationContext context) {
        if (!input.wantsRevised()) return RevisedClauses.EMPTY;
        RevisedClauses drafted = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.revise(input, brainstorm, report), RevisedClauses.class);
        if (drafted == null) return RevisedClauses.EMPTY;
        return new RevisedClauses(drafted.items().stream().map(i -> new RevisedClauses.RevisedClause(i.clauseNo(),
                TaiwanTerminology.sanitize(i.original()), TaiwanTerminology.sanitize(i.revised()), TaiwanTerminology.sanitize(i.rationale()))).toList());
    }

    /** 步驤 GRAPH（goal）：契約義務三層圖；clause 節點風險由伺服器依報告覆寫。revised 參數確保修訂先完成。 */
    @AchievesGoal(description = "A compliance report and obligation graph for the contract")
    @Action
    public GraphOutcome buildContractGraph(ContractInput input, ContractBrainstorm brainstorm, ResearchResult research,
                                           ComplianceReport report, RevisedClauses revised, OperationContext context) {
        GraphData raw = llm(context).withReference(skills).withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(ContractPrompts.graph(input, brainstorm, research, report), GraphData.class);
        return ContractGraphRules.apply(raw == null ? new GraphData(List.of(), List.of()) : raw, research, report);
    }
```

- [ ] **Step 4: 跑** — `-Dtest='ContractReviewAgentGraphTest,ContractReviewAgentTest'` PASS
- [ ] **Step 5: Commit** — `feat(agent): 合約流程加修訂條款與契約義務圖，goal 改為建圖`

---

### Task 4: 狀態層帶 revised；COMPLETED 需有圖

**Files:**
- Modify: `api/StatusSnapshot.java`（尾端 +`RevisedClauses revised`，17 參數建構子保留並補 null）、`api/CaseStatus.java`（Result 尾端 +`RevisedClauses revised`；9 參數建構子保留）、`api/StatusMapper.java`、`api/CaseService.java`
- Test: `api/StatusMapperContractTest.java`（修改）

- [ ] **Step 1: 測試調整**
  - `completedContractExposesComplianceWithoutGraph` 改名 `completedContractRequiresGraph`：有 compliance 無 outcome → `FAILED`／`COMPLETED_WITHOUT_GRAPH`；有 outcome → COMPLETED、step GRAPH、`result.graph` 非 null、`result.revised` 等於快照 revised。
  - deriveStep：`compliance != null && outcome == null` → `GRAPH`（進行中建圖）；`revised != null` 亦 GRAPH。
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**：`mapContract` COMPLETED 分支：`if (s.compliance() == null) failed(..."COMPLETED_WITHOUT_REPORT"...)；if (s.outcome() == null) failed(..."COMPLETED_WITHOUT_GRAPH", "process completed without a graph", step)`；Result 帶 `s.outcome().graph()` 與 `s.revised()`；step 固定 `"GRAPH"`。`partialContract` 亦帶 revised。CaseService.snapshot 尾端加 `blackboard.last(RevisedClauses.class)`。
- [ ] **Step 4: 跑** — `-Dtest='StatusMapperContractTest,StatusMapperTest,CaseServiceContractTest'` PASS
- [ ] **Step 5: Commit** — `feat(api): 合約狀態帶修訂條款；完成需含關係圖`

---

### Task 5: 判決關鍵字查詢 mainText

**Files:**
- Modify: `src/main/java/tw/lawgraph/research/ResearchPlan.java`（`JudgmentKeywordQuery` 尾端 +`String mainText`，保留 6 參數建構子）
- Modify: `src/main/java/tw/lawgraph/research/mcp/McpTaiwanLegalDbAdapter.java:85`（`putIfNotBlank(arguments, "main_text", query.mainText())`）
- Modify: `agent/ContractPrompts.research`：judgmentKeywordQueries 說明加 `mainText: optionally "被告應給付" (defendant lost) or "原告之訴駁回" (plaintiff lost) to fetch judgments where such a clause was actually held void`
- Test: `src/test/java/tw/lawgraph/research/mcp/McpTaiwanLegalDbAdapterMainTextTest.java`

- [ ] **Step 1: 測試**
```java
package tw.lawgraph.research.mcp;
import org.junit.jupiter.api.Test;
import tw.lawgraph.research.ResearchPlan;
import static org.junit.jupiter.api.Assertions.*;
class McpTaiwanLegalDbAdapterMainTextTest {
    @Test void mainTextForwardedWhenPresent() {
        var q = new ResearchPlan.JudgmentKeywordQuery("加班費 放棄", "民事", "", "", "", 5, "被告應給付");
        assertEquals("被告應給付", McpTaiwanLegalDbAdapter.judgmentArguments(q).get("main_text"));
        var legacy = new ResearchPlan.JudgmentKeywordQuery("x", "", "", "", "", null);
        assertFalse(McpTaiwanLegalDbAdapter.judgmentArguments(legacy).containsKey("main_text"));
        assertEquals("", legacy.mainText());
    }
}
```
- [ ] **Step 2: 跑** — 編譜錯誤
- [ ] **Step 3: 實作**：record 加欄位＋`mainText = normalize(mainText)`＋相容建構子 `this(keyword, caseType, court, fromDate, toDate, maxResults, "")`；adapter 加一行。
- [ ] **Step 4: 跑** — `-Dtest='McpTaiwanLegalDbAdapterMainTextTest,*ResearchPlan*,*Adapter*'` PASS；全套 `mvn -q test` 綠燈
- [ ] **Step 5: Commit** — `feat(research): 判決關鍵字查詢支援 main_text 輸贏方篩選`

---

### Task 6: 結果頁 doc-revised 面板、graph 分頁與圖例

**Files:**
- Modify: `static/js/views/result.js`、`static/js/graphView.js`
- Test: `frontend-tests/views.test.mjs`

- [ ] **Step 1: 測試**
```js
test('合約 revised 面板顯示原條款與修訂後對照；graph 分頁在有圖時出現', () => {
  const status = { locale: 'zh-TW', mode: 'contract', result: { compliance: { findings: [] }, research: { laws: [], judgments: [] },
    revised: { items: [{ clauseNo: '第二條', original: '舊', revised: '新<b>', rationale: '依勞基法24' }] }, graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['revised'], mode: 'contract', activeTab: 'doc-revised' }, 'zh-TW');
  assert.match(html, /data-tab="doc-revised"[^>]*>修訂版條款/);
  assert.match(html, /<th scope="col">原條款<\/th>/); assert.match(html, /新&lt;b&gt;/);
  assert.match(html, /data-tab="graph"/);
});
```
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**：
```js
/** 修訂條款對照表：原條款｜修訂後｜理由。 */
function renderRevised(revised, locale) {
  const items = revised?.items || [];
  if (!items.length) return `<p class="doc-missing">${ICONS.info}<span>${esc(t('doc.missing', locale))}</span></p>`;
  const head = ['clauseNo', 'original', 'revised', 'rationale'].map((k) => `<th scope="col">${esc(t(k === 'clauseNo' ? 'finding.clauseNo' : 'revised.' + k, locale))}</th>`).join('');
  const rows = items.map((i) => `<tr><td>${esc(i.clauseNo)}</td><td class="clause-text">${esc(i.original)}</td><td class="clause-text">${esc(i.revised)}</td><td>${esc(i.rationale)}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="assess-table revised-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div><p class="disclaimer">${ICONS.info}<span>${esc(t('doc.disclaimer', locale))}</span></p>`;
}
```
`graphView.js` 圖例（既有 legend 建構處，約第 251 行附近）：contract 模式圖（存在 `contract` 群組節點）時附加 risk 三色說明列（`graph.risk.high/medium/low` 已有鍵）。找到產生群組篩選器的函式，在群組清單後加：
```js
  // 契約圖：附風險色說明（只在有 clause 節點時）
  if (nodes.some((n) => n.group === 'clause')) legendBox.insertAdjacentHTML('beforeend', ['high', 'medium', 'low'].map((r) => `<span class="legend-risk risk-${r}">${esc(t('graph.risk.' + r, locale))}</span>`).join(''));
```
（依 graphView 實際 DOM 建構方式調整位置；`graphView.test.mjs` 若有 legend 斷言一併補。）
- [ ] **Step 4: 跑** — `npm test` PASS
- [ ] **Step 5: Commit** — `feat(web): 修訂條款對照面板與契約圖風險圖例`

---

### Task 7: WebMCP 六個新工具與 HOME 狀態

**Files:**
- Modify: `static/js/webmcp.js`、`static/js/app.js`
- Test: `frontend-tests/webmcp.test.mjs`、`frontend-tests/app.test.mjs`

**Interfaces:**
- TOOL_DEFS 新增：
  - `listCapabilities`（base，readOnly）：`S({})` → `{ capabilities: [{ mode, title, steps[] }], current: mode|null, view }`
  - `selectCapability`（base）：`S({ mode: enum[case,contract] }, ['mode'])` → 呼叫 `app.selectMode`
  - `startContractReview`（base）：`S({ contractText: {minLength:20}, sampleId, party: enum, scopes: array enum, outputs: array enum['revised'], locale }, [])`；view 必須 INPUT 且 mode contract（否則先 selectMode('contract') 再啟動）
  - `getComplianceReport`（completed，readOnly＋untrustedContentHint）：`S({ risk: enum[all,high,medium,low] })` → truncate 報告（findings 依 risk 過濾）
  - `filterFindingsByRisk`（completed）：`S({ risk: enum }, ['risk'])` → `app.setRiskFilter`
  - `getUsageStats`（base，readOnly）：`S({ days: integer 1–90 })` → M3 實作；本里程碑先回 `{ ok:false, error:'NOT_AVAILABLE' }`（M3 接上）。
- `TOOL_NAMES_BY_VIEW.HOME = ['listCapabilities','selectCapability','startCase','startContractReview','listSampleCases','verifyCitation','getUsageStats']`；INPUT 加 `listCapabilities`、`selectCapability`、`startContractReview`、`getUsageStats`；RESULT 加 `getComplianceReport`、`filterFindingsByRisk`、`getUsageStats`
- `pageStatus()`／`getCaseStatus` 加 `mode`；`startCase` 在 mode=contract 的 INPUT 頁回 `WRONG_CAPABILITY` 提示改用 startContractReview（反之亦然）

- [ ] **Step 1: 測試**（webmcp.test.mjs：工具數 16→22；加）
```js
test('新工具契約：HOME 可選能力，合約工具只在對應狀態', () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.ok(TOOL_NAMES_BY_VIEW.HOME.includes('selectCapability'));
  assert.ok(TOOL_NAMES_BY_VIEW.RESULT.includes('getComplianceReport'));
  assert.equal(byName.getComplianceReport.annotations.untrustedContentHint, true);
  assert.deepEqual(byName.selectCapability.inputSchema.properties.mode.enum, ['case', 'contract']);
  assert.ok(byName.startContractReview.inputSchema.properties.party.enum.includes('partyB'));
});
test('startContractReview 從 HOME 先選能力再啟動；getComplianceReport 依 risk 過濾', async () => {
  const state = { view: 'HOME', mode: null, last: null };
  const app = {
    getState: () => state, getLocale: () => 'zh-TW', getMode: () => state.mode,
    selectMode: async (m) => { state.view = 'INPUT'; state.mode = m; },
    start: async (text, outputs, files, motion, extra) => { state.view = 'RUNNING'; return { caseId: 'c1', status: 'RUNNING', step: 'LOAD', extra }; },
    setRiskFilter: () => {}
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('startContractReview', { contractText: '合約全文超過二十個字的測試內容合約全文', party: 'partyB', scopes: ['labor'] });
  assert.equal(r.ok, true); assert.equal(state.mode, 'contract');
  state.view = 'RESULT'; state.last = { result: { compliance: { overallRisk: 'high', findings: [{ risk: 'high' }, { risk: 'low' }] } } };
  const report = await w.execute('getComplianceReport', { risk: 'high' });
  assert.equal(report.findings.length, 1);
});
```
- [ ] **Step 2: 跑** — FAIL
- [ ] **Step 3: 實作**（webmcp.js exec 追加）
```js
    listCapabilities: async () => ({ ok: true, view: currentView(), current: app.getMode?.() || null,
      capabilities: [{ mode: 'case', title: 'Case analysis', steps: ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'ASSESSMENT', 'DOCUMENTS', 'GRAPH'], startTool: 'startCase' },
        { mode: 'contract', title: 'Contract compliance review', steps: ['LOAD', 'QUESTIONS', 'RESEARCH', 'REVIEW', 'SUMMARY', 'REVISE', 'GRAPH'], startTool: 'startContractReview' }],
      nextAction: 'Call selectCapability to open a capability, or its start tool directly.' }),
    selectCapability: async ({ mode }) => {
      if (!['HOME', 'INPUT'].includes(currentView())) return unavailable('selectCapability');
      await app.selectMode(mode); return { ok: true, mode, view: currentView() };
    },
    startContractReview: async ({ contractText, sampleId, party, scopes, outputs, locale }) => {
      if (!['HOME', 'INPUT'].includes(currentView())) { const c = pageStatus(); return { ok: false, error: 'CASE_IN_PROGRESS', current: c, nextAction: c.nextAction }; }
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      if (app.getMode?.() !== 'contract') await app.selectMode('contract');
      const extra = { party: party || 'unknown', scopes: Array.isArray(scopes) ? scopes : [] };
      const s = sampleId ? await app.startSample(sampleId, outputs || [], extra) : await app.start(contractText, outputs || [], [], '', extra);
      if (!s) return { ok: false, error: 'Unknown sampleId or empty contractText.' };
      return { ok: true, caseId: s.caseId, status: s.status, step: s.step, mode: 'contract', nextAction: 'Poll getCaseStatus; on COMPLETED call getComplianceReport.' };
    },
    getComplianceReport: async ({ risk = 'all' } = {}) => {
      const c = app.getState().last?.result?.compliance; if (!c) return { error: 'not completed' };
      return truncate({ ...c, findings: (c.findings || []).filter((f) => risk === 'all' || f.risk === risk) }, 4000);
    },
    filterFindingsByRisk: async ({ risk }) => { app.setRiskFilter(risk); return { ok: true, risk }; },
    getUsageStats: async () => ({ ok: false, error: 'NOT_AVAILABLE', message: 'Usage statistics arrive in the next release.' }),
```
`startCase` 開頭加：`if (app.getMode?.() === 'contract' && currentView() === 'INPUT') return { ok: false, error: 'WRONG_CAPABILITY', message: 'The contract review form is open. Use startContractReview, or selectCapability("case") first.' };`（startContractReview 相反邏輯由 selectMode 自動處理）。`pageStatus()` 回傳加 `mode: app.getMode?.() || null`，view HOME 的 status 對照 `HOME: 'NONE'`。

- [ ] **Step 4: 跑** — `npm test` 全綠；`npm run bundle`
- [ ] **Step 5: Commit** — `feat(webmcp): 能力選擇、合約審查啟動、合規報告讀取等六個工具（22 工具）`

---

### Task 8: smoke 補合約圖與工具清單；M2 收尾

- [ ] smoke：在 M1 的合約 COMPLETED 測試裡加 `graph: { nodes: [{ id: 'c', group: 'contract', label: '勞動契約' }, { id: 'cl', group: 'clause', label: '第二條', risk: 'high' }], edges: [{ from: 'c', to: 'cl', label: '包含' }] }` 與 `revised: { items: [...] }`，斷言 `[data-tab="graph"]`、`[data-tab="doc-revised"]` 存在（outputs 需先 `window.__lawGraphApp` 以 `startRequest`… 簡化：dispatch 前 `sessionStorage.setItem('outputs','["revised"]')` 並重新 mount，或改在 status 中帶 `outputs`；最簡：測試只驗 graph 分頁，doc-revised 由 views 單元測試守）。再加：HOME 狀態 `document.modelContext.getTools()` 含 `selectCapability` 與 `startContractReview`。
- [ ] `mvn -q test`、`npm test`、`npm run bundle`、smoke 全綠，log 進 `artifacts/m2-*.log`。
- [ ] README／CLAUDE.md 補：工具 22 個、合約圖、mainText。
- [ ] 本機 live：以 nano header 跑 `labor-contract` 勾 revised，確認 `result.graph.nodes` 含 `clause` 且 `risk` 非空、`result.revised.items` 非空。存 `artifacts/m2-live-contract.json`。
- [ ] Commit：`docs: 合約審查 M2 完成`。

## Self-Review

- §4.5 圖／修訂（Task 6）、§4.7 工具（Task 7；getUsageStats 佈樁待 M3）、§5.1 REVISE／GRAPH（Task 3）、§5.4（Task 5）皆有任務。
- 型別一致：`RevisedClauses.RevisedClause(clauseNo, original, revised, rationale)` 在 Task 1／3／6 一致；`buildContractGraph` 六參數在 Task 3／4 一致；`app.selectMode／setRiskFilter／getMode` 由 M1 Task 14 提供，Task 7 消費。
