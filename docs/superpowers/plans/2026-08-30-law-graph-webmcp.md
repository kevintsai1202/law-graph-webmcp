# law-graph-webmcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 law-powers 法律技能包做成網站：貼入案情 → 頭腦風暴 → 使用者回答提問 → 檢索法規判決 → 涵攝分析 → 3D 法律關係圖；頁面以 WebMCP 暴露十個工具供 ChatGPT／Chrome Agent 操作。

**Architecture:** Spring Boot 4.1 ＋ Embabel 1.5.1 單一 Agent（五個 `@Action` ＋ 一個 `WaitFor.awaitable`），透過 `embabel-agent-skills` 直接載入 law-powers 的 SKILL.md；法律資料只接 `taiwan-legal-db`（Python sidecar，Streamable HTTP MCP）。前端純 HTML/JS，2 秒輪詢 `GET /api/cases/{id}`；三條硬規則（檢索錨定、涵攝單一來源、連線白名單）在 Java 層執行。

**Tech Stack:** Java 21、Spring Boot 4.1.0、Embabel 1.5.1（`embabel-agent-starter-openai`、`embabel-agent-skills`、`embabel-agent-test`）、OpenAI `gpt-5.4-mini`、Spring AI 2.0.0 MCP client、Python 3.12 ＋ `mcp-taiwan-legal-db`（`mcp<2`）、three.js／3d-force-graph（自 law-powers 複製）、Node 20 `node --test`、Playwright、Docker Compose、Cloudflare Tunnel。

**Spec:** `docs/superpowers/specs/2026-08-30-law-graph-webmcp-design.md`

## Global Constraints

- 專案根目錄：`d:\GitHub\webmcp\law-graph-webmcp`（已 `git init`，branch `main`，已有 spec commit）。所有指令在此目錄執行；Windows PowerShell 7。
- Java 21；Spring Boot parent `4.1.0`；Embabel BOM `com.embabel.agent:embabel-agent-dependencies:1.5.1`（import scope）；Jackson 3（`tools.jackson.*`，註解仍是 `com.fasterxml.jackson.annotation.*`）。
- LLM：`embabel.models.default-llm: gpt-5.4-mini`；環境變數 `OPENAI_API_KEY`。
- 法律 MCP 只允許六個工具：`search_regulations`、`query_regulation`、`get_pcode`、`search_judgments`、`get_judgment`、`get_citations`。不接 `dr-lawbot`。
- 只掛四個技能：`legal-brainstorming`、`legal-research`、`legal-element-analysis`、`legal-graph`（用 `withLocalSkill` 逐一掛，**不可** `withLocalSkills(parent)`）。
- 語系：`en`（預設）、`zh-TW`；WebMCP 工具契約固定英文；條號／字號雙寫「英文標籤（原文）」且原文為比對鍵。
- WebMCP：只用 `document.modelContext.registerTool()`；無 `answerQuestions` 工具；單次回傳 ≤ 1500 字元；description ≤ 150 字、name ≤ 30 字。
- 每個程式任務：先寫失敗測試 → 實作 → 測試綠 → commit。commit message 結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 長時指令（`mvn verify`、`docker compose build`）輸出 `| Tee-Object -FilePath logs/<name>.log`。
- 文件與註解使用繁體中文；程式識別字英文；每個 Java 類與公開方法、每個 JS 模組與函式都要有中文註解。

## File Structure

```text
law-graph-webmcp/
├── pom.xml                                  Maven：Boot 4.1 parent、Embabel BOM、依賴
├── LICENSE                                  MIT
├── .gitignore / .gitmodules
├── skills/law-powers/                       git submodule → kevintsai1202/law-powers（用其 skills/ 子目錄）
├── docker/legal-mcp/Dockerfile              Python sidecar（mcp-taiwan-legal-db）
├── docker/app/Dockerfile                    多階段：maven build → temurin 21 jre
├── docker-compose.yml                       app / legal-mcp / cloudflared
├── logs/                                    長時指令輸出（gitignore）
├── src/main/java/tw/lawgraph/
│   ├── LawGraphApplication.java             @SpringBootApplication @EnableAgents
│   ├── domain/                              純資料型別（record）與硬規則
│   │   ├── Locale.java  CaseInput.java  Question.java  BrainstormResult.java  Answer.java  UserAnswers.java
│   │   ├── LawRef.java  JudgmentRef.java  ResearchResult.java  Met.java  ElementFinding.java  AnalysisResult.java
│   │   ├── GraphNode.java  GraphEdge.java  GraphData.java  EdgeLabel.java  GraphOutcome.java
│   │   └── GraphRules.java                  三條硬規則
│   ├── agent/
│   │   ├── LegalGraphAgent.java             @Agent，五個 @Action
│   │   ├── LegalPrompts.java                system prompt 與各 Action user prompt（純函式）
│   │   ├── QuestionsAwaitable.java  AnswersResponse.java
│   │   └── config/SkillsConfig.java  config/ToolGroupsConfig.java
│   ├── api/
│   │   ├── CaseStatus.java  CaseController.java  CaseService.java  StatusMapper.java  StatusSnapshot.java
│   │   ├── RateLimiter.java  ApiExceptionHandler.java
│   │   ├── SamplesController.java  SampleCase.java
│   │   └── CitationVerifier.java  VerifyController.java
│   └── (resources)
│       ├── application.yml  application-test.yml
│       ├── samples/en.json  samples/zh-TW.json
│       └── static/  index.html  css/app.css  js/*.js  js/views/*.js  vendor/*.js
├── src/test/java/tw/lawgraph/...            對應測試
├── frontend-tests/*.test.mjs                node --test（純函式）
├── e2e/  playwright.config.mjs  journey.spec.mjs
├── scripts/eval-samples.mjs  scripts/fetch-vendor.ps1
└── README.md
```

---

### Task 1: 專案骨架、Maven 建置與 submodule

**Files:**
- Create: `pom.xml`、`.gitignore`、`LICENSE`、`src/main/java/tw/lawgraph/LawGraphApplication.java`、`src/main/resources/application.yml`、`src/main/resources/application-test.yml`、`src/test/java/tw/lawgraph/SmokeTest.java`
- Submodule: `skills/law-powers`

**Interfaces:**
- Produces: Maven 專案可 `mvn -q test`；`tw.lawgraph` 套件根；設定鍵 `lawgraph.skills-dir`、`lawgraph.rate-limit-per-hour`、`embabel.models.default-llm`。

- [ ] **Step 1: 建立 pom.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.0</version>
    <relativePath/>
  </parent>
  <groupId>tw.lawgraph</groupId>
  <artifactId>law-graph-webmcp</artifactId>
  <version>0.1.0-SNAPSHOT</version>
  <name>law-graph-webmcp</name>
  <description>WebMCP-enabled Taiwan legal relationship graph powered by law-powers skills and Embabel</description>
  <properties>
    <java.version>21</java.version>
    <embabel-agent.version>1.5.1</embabel-agent.version>
  </properties>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>com.embabel.agent</groupId>
        <artifactId>embabel-agent-dependencies</artifactId>
        <version>${embabel-agent.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>
    <dependency>
      <groupId>com.embabel.agent</groupId>
      <artifactId>embabel-agent-starter-openai</artifactId>
      <version>${embabel-agent.version}</version>
    </dependency>
    <dependency>
      <groupId>com.embabel.agent</groupId>
      <artifactId>embabel-agent-skills</artifactId>
      <version>${embabel-agent.version}</version>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-webmvc-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>com.embabel.agent</groupId>
      <artifactId>embabel-agent-test</artifactId>
      <version>${embabel-agent.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-testcontainers</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 2: 建立 .gitignore、LICENSE（MIT，著作權人 Kevin Tsai，年份 2026）**

`.gitignore`：
```text
target/
logs/
node_modules/
e2e/screenshots/
eval/
.env
*.log
```

- [ ] **Step 3: 加入 law-powers submodule**

```powershell
git submodule add https://github.com/kevintsai1202/law-powers.git skills/law-powers
Test-Path skills/law-powers/skills/legal-graph/SKILL.md   # 必須為 True
```

- [ ] **Step 4: 主程式與設定檔**

`src/main/java/tw/lawgraph/LawGraphApplication.java`：
```java
package tw.lawgraph;

import com.embabel.agent.config.annotation.EnableAgents;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 應用程式入口：啟用 Embabel Agent 平台與 Spring MVC。 */
@SpringBootApplication
@EnableAgents
public class LawGraphApplication {
    public static void main(String[] args) {
        SpringApplication.run(LawGraphApplication.class, args);
    }
}
```

`src/main/resources/application.yml`：
```yaml
embabel:
  models:
    default-llm: gpt-5.4-mini
spring:
  ai:
    mcp:
      client:
        enabled: true
        type: SYNC
        request-timeout: 60s
        streamable-http:
          connections:
            legal-mcp:
              url: ${LEGAL_MCP_URL:http://localhost:8000}
lawgraph:
  skills-dir: ${LAWGRAPH_SKILLS_DIR:skills/law-powers/skills}
  rate-limit-per-hour: 10
```

`src/main/resources/application-test.yml`（測試不連 MCP、不需要真金鑰）：
```yaml
spring:
  ai:
    mcp:
      client:
        enabled: false
```

- [ ] **Step 5: 煙霧測試（只驗證建置與套件掃描，不啟動完整 context）**

`src/test/java/tw/lawgraph/SmokeTest.java`：
```java
package tw.lawgraph;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** 建置煙霧測試：確認主類別可載入。 */
class SmokeTest {
    @Test
    void mainClassLoads() {
        assertNotNull(LawGraphApplication.class);
    }
}
```

- [ ] **Step 6: 執行建置**

Run: `mvn -q test 2>&1 | Tee-Object -FilePath logs/task1-test.log`（先 `New-Item -ItemType Directory -Force logs`）
Expected: `BUILD SUCCESS`，1 test passed。若 Embabel 相依解析失敗，檢查 Maven Central 是否可達；不可加私有 repo。

- [ ] **Step 7: Commit**

```powershell
git add pom.xml .gitignore .gitmodules LICENSE skills src
git commit -m "chore: 專案骨架、Embabel 1.5.1 依賴與 law-powers submodule"
```

---

### Task 2: 領域型別與 GraphData 序列化

**Files:**
- Create: `src/main/java/tw/lawgraph/domain/*.java`（見下）
- Test: `src/test/java/tw/lawgraph/domain/GraphDataJsonTest.java`

**Interfaces:**
- Produces（後續所有任務依賴這些名稱）：
  - `enum Locale { EN("en"), ZH_TW("zh-TW"); String code(); static Locale fromCode(String) }`
  - `record CaseInput(String text, Locale locale)`
  - `record Question(String id, String text, String why)`
  - `record BrainstormResult(List<String> facts, List<String> relations, List<String> issues, List<String> evidenceNeeds, List<Question> questions)`
  - `record Answer(String questionId, String answer)`、`record UserAnswers(List<Answer> answers)`
  - `record LawRef(String ref, String title, String articleText, String source)`
  - `record JudgmentRef(String jid, String citation, String court, String date, String summary, String url)`
  - `record ResearchResult(List<LawRef> laws, List<JudgmentRef> judgments, List<String> notes)`
  - `enum Met { yes, no, unknown }`、`record ElementFinding(String law, String element, Met met, String basis, String fact)`
  - `record AnalysisResult(List<ElementFinding> elements, String strategy, List<String> evidenceGaps, String disclaimer)`
  - `record GraphNode(String id, String group, String label, String description, String ref, String jid, String met, String status, String url, String family, String favorable, String risk, String duty, String role)` 以 `@JsonInclude(NON_NULL)`
  - `record GraphEdge(String from, String to, String label, String title, String rel)`
  - `record GraphData(List<GraphNode> nodes, List<GraphEdge> edges)`
  - `enum EdgeLabel`（19 個中文標籤）＋ `static boolean isValid(String label)`
  - `record GraphOutcome(GraphData graph, List<String> notes)`

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** GraphData 需與 law-powers data.js 的 superset 格式相容：edges 用 from/to，空欄位不輸出。 */
class GraphDataJsonTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void serializesEdgesWithFromToAndOmitsNulls() {
        var g = new GraphData(
            List.of(new GraphNode("f1", "fact", "Accident", null, null, null, null, null, null, null, null, null, null, null)),
            List.of(new GraphEdge("f1", "l1", "適用", null, null)));
        String json = mapper.writeValueAsString(g);
        assertTrue(json.contains("\"from\":\"f1\""));
        assertTrue(json.contains("\"to\":\"l1\""));
        assertFalse(json.contains("\"description\""), "null 欄位不得輸出，否則渲染器會顯示 null");
    }

    @Test
    void edgeLabelWhitelistContainsAllNineteenLabels() {
        assertEquals(19, EdgeLabel.values().length);
        assertTrue(EdgeLabel.isValid("適用"));
        assertTrue(EdgeLabel.isValid("刑事附帶民事 (民附)"));
        assertFalse(EdgeLabel.isValid("applies to"));
    }

    @Test
    void localeParsesCodesAndDefaultsToEnglish() {
        assertEquals(Locale.ZH_TW, Locale.fromCode("zh-TW"));
        assertEquals(Locale.EN, Locale.fromCode(null));
        assertEquals(Locale.EN, Locale.fromCode("fr"));
    }
}
```

- [ ] **Step 2: 執行確認失敗**

Run: `mvn -q test -Dtest=GraphDataJsonTest`
Expected: 編譯錯誤（類別不存在）。

- [ ] **Step 3: 實作型別**

`Locale.java`：
```java
package tw.lawgraph.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 支援的輸出語系；未知或空值一律回英文。 */
public enum Locale {
    EN("en"), ZH_TW("zh-TW");
    private final String code;
    Locale(String code) { this.code = code; }
    @JsonValue public String code() { return code; }
    @JsonCreator public static Locale fromCode(String code) {
        for (var l : values()) if (l.code.equalsIgnoreCase(code)) return l;
        return EN;
    }
}
```

`EdgeLabel.java`：
```java
package tw.lawgraph.domain;

import java.util.Arrays;

/** legal-graph 技能定義的連線標籤白名單；渲染器依這些字串分流樣式。 */
public enum EdgeLabel {
    APPLY("適用"), CITE("引用"), CIVIL_ATTACHED("刑事附帶民事 (民附)"), APPEAL("上訴"),
    JOINT("連帶責任/保證"), DEFENSE("抗辯/阻斷"), PRESERVE("保全/假扣押"), LAW_REL("法條關聯"),
    PARTY("當事人"), EVIDENCE("證據"), INCLUDE("包含"), IMPOSE("課予"), BEAR("負擔"),
    CLAIM("得請求"), CONSIDERATION("對價"), BREACH("違約效果"), ELEMENT("要件"), MEETS("該當"),
    ELEMENT_FINDING("要件認定");
    private final String label;
    EdgeLabel(String label) { this.label = label; }
    public String label() { return label; }
    /** 是否為合法標籤（完全相符）。 */
    public static boolean isValid(String label) {
        return label != null && Arrays.stream(values()).anyMatch(e -> e.label.equals(label));
    }
}
```

其餘 record 各自一檔，依 Interfaces 區塊的簽章逐字建立；`GraphNode` 加 `@com.fasterxml.jackson.annotation.JsonInclude(JsonInclude.Include.NON_NULL)`；每個 record 上方一行中文註解說明用途（例：`/** 檢索到的法條：ref 為原文條號，是硬規則 1 的比對鍵。 */`）。

- [ ] **Step 4: 測試通過**

Run: `mvn -q test -Dtest=GraphDataJsonTest`
Expected: 3 tests pass。

- [ ] **Step 5: Commit**

```powershell
git add src/main/java/tw/lawgraph/domain src/test/java/tw/lawgraph/domain/GraphDataJsonTest.java
git commit -m "feat(domain): 領域型別、EdgeLabel 白名單與 GraphData 序列化"
```

---

### Task 3: 硬規則 GraphRules

**Files:**
- Create: `src/main/java/tw/lawgraph/domain/GraphRules.java`
- Test: `src/test/java/tw/lawgraph/domain/GraphRulesTest.java`

**Interfaces:**
- Consumes: Task 2 型別。
- Produces: `public final class GraphRules { public static GraphOutcome apply(GraphData raw, ResearchResult research, AnalysisResult analysis) }`
  - 規則 1：`group=law` 節點需 `ref` ∈ `research.laws[].ref`；`group=judgment` 需 `jid` ∈ `research.judgments[].jid`；否則移除節點與其連線，notes 加 `"removed unverified <group> node: <label>"`。
  - 規則 2：`group=element` 節點 `met` 一律改為 `analysis.elements` 中 `element.equals(node.label)` 者的 `met.name()`；找不到則 `met=null`。
  - 規則 3：`EdgeLabel.isValid(label)` 為 false 或端點不存在的邊移除，notes 加 `"removed edge: <from>-><to> (<label>)"`。

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 三條硬規則：檢索錨定、涵攝單一來源、連線白名單。 */
class GraphRulesTest {
    private static GraphNode node(String id, String group, String label, String ref, String jid, String met) {
        return new GraphNode(id, group, label, null, ref, jid, met, null, null, null, null, null, null, null);
    }
    private final ResearchResult research = new ResearchResult(
        List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "...", "law.moj.gov.tw")),
        List.of(new JudgmentRef("TPSV,108,台上,2345", "最高法院108年度台上字第2345號", "最高法院", "2019-05-01", "...", null)),
        List.of());
    private final AnalysisResult analysis = new AnalysisResult(
        List.of(new ElementFinding("民法第184條第1項", "相當因果關係", Met.unknown, "通說", "未見行車紀錄")),
        "strategy", List.of(), "disclaimer");

    @Test
    void rule1RemovesLawAndJudgmentNodesNotInResearch() {
        var raw = new GraphData(List.of(
            node("l1", "law", "Civil Code Art. 184 ¶1（民法第184條第1項）", "民法第184條第1項", null, null),
            node("l2", "law", "Civil Code Art. 999（民法第999條）", "民法第999條", null, null),
            node("j1", "judgment", "Supreme Court 108-Tai-Shang-2345", null, "TPSV,108,台上,2345", null),
            node("j2", "judgment", "Hallucinated", null, "FAKE,1,1,1", null)),
            List.of(new GraphEdge("j2", "l1", "引用", null, null)));
        var out = GraphRules.apply(raw, research, analysis);
        var ids = out.graph().nodes().stream().map(GraphNode::id).toList();
        assertEquals(List.of("l1", "j1"), ids);
        assertTrue(out.graph().edges().isEmpty(), "連到被移除節點的邊也要移除");
        assertEquals(2, out.notes().stream().filter(n -> n.startsWith("removed unverified")).count());
    }

    @Test
    void rule2OverridesMetFromAnalysisOnly() {
        var raw = new GraphData(List.of(
            node("e1", "element", "相當因果關係", null, null, "yes"),
            node("e2", "element", "不存在的要件", null, null, "yes")), List.of());
        var out = GraphRules.apply(raw, research, analysis);
        assertEquals("unknown", out.graph().nodes().get(0).met());
        assertNull(out.graph().nodes().get(1).met(), "涵攝表沒有的要件不得保留模型自填的 met");
    }

    @Test
    void rule3DropsInvalidLabelsAndDanglingEdges() {
        var raw = new GraphData(List.of(node("f1", "fact", "A", null, null, null), node("i1", "issue", "B", null, null, null)),
            List.of(new GraphEdge("f1", "i1", "抗辯/阻斷", null, null),
                    new GraphEdge("f1", "i1", "relates to", null, null),
                    new GraphEdge("f1", "ghost", "適用", null, null)));
        var out = GraphRules.apply(raw, research, analysis);
        assertEquals(1, out.graph().edges().size());
        assertEquals(2, out.notes().stream().filter(n -> n.startsWith("removed edge")).count());
    }
}
```

- [ ] **Step 2: 執行確認失敗**

Run: `mvn -q test -Dtest=GraphRulesTest` → 編譯錯誤 `GraphRules` 不存在。

- [ ] **Step 3: 實作**

```java
package tw.lawgraph.domain;

import java.util.*;
import java.util.stream.Collectors;

/** 建圖後的三條硬規則；純函式，不依賴 prompt。 */
public final class GraphRules {
    private GraphRules() {}

    /** 套用三條規則並回傳過濾後的圖與剔除紀錄。 */
    public static GraphOutcome apply(GraphData raw, ResearchResult research, AnalysisResult analysis) {
        List<String> notes = new ArrayList<>();
        Set<String> lawRefs = research.laws().stream().map(LawRef::ref).collect(Collectors.toSet());
        Set<String> jids = research.judgments().stream().map(JudgmentRef::jid).collect(Collectors.toSet());
        Map<String, Met> metByElement = new HashMap<>();
        for (var f : analysis.elements()) metByElement.put(f.element(), f.met());

        List<GraphNode> nodes = new ArrayList<>();
        for (var n : raw.nodes()) {
            if ("law".equals(n.group()) && (n.ref() == null || !lawRefs.contains(n.ref()))) {
                notes.add("removed unverified law node: " + n.label()); continue;
            }
            if ("judgment".equals(n.group()) && (n.jid() == null || !jids.contains(n.jid()))) {
                notes.add("removed unverified judgment node: " + n.label()); continue;
            }
            if ("element".equals(n.group())) {
                Met met = metByElement.get(n.label());
                n = new GraphNode(n.id(), n.group(), n.label(), n.description(), n.ref(), n.jid(),
                    met == null ? null : met.name(), n.status(), n.url(), n.family(), n.favorable(), n.risk(), n.duty(), n.role());
            }
            nodes.add(n);
        }
        Set<String> ids = nodes.stream().map(GraphNode::id).collect(Collectors.toSet());
        List<GraphEdge> edges = new ArrayList<>();
        for (var e : raw.edges()) {
            boolean ok = EdgeLabel.isValid(e.label()) && ids.contains(e.from()) && ids.contains(e.to());
            if (ok) edges.add(e);
            else notes.add("removed edge: " + e.from() + "->" + e.to() + " (" + e.label() + ")");
        }
        return new GraphOutcome(new GraphData(nodes, edges), notes);
    }
}
```

- [ ] **Step 4: 測試通過** — Run: `mvn -q test -Dtest=GraphRulesTest` → 3 pass。

- [ ] **Step 5: Commit**

```powershell
git add src/main/java/tw/lawgraph/domain/GraphRules.java src/test/java/tw/lawgraph/domain/GraphRulesTest.java
git commit -m "feat(domain): GraphRules 三條硬規則"
```

---

### Task 4: 提問等待物件 QuestionsAwaitable／AnswersResponse

**Files:**
- Create: `src/main/java/tw/lawgraph/agent/QuestionsAwaitable.java`、`src/main/java/tw/lawgraph/agent/AnswersResponse.java`
- Test: `src/test/java/tw/lawgraph/agent/QuestionsAwaitableTest.java`

**Interfaces:**
- Consumes: `UserAnswers`、`Question`、`Answer`（Task 2）。
- Produces:
  - `QuestionsAwaitable extends AbstractAwaitable<UserAnswers, AnswersResponse>`；`List<Question> questions()`；`onResponse(AnswersResponse, AgentProcess)` 把 `new UserAnswers(response.answers())` 加入 `agentProcess.getBlackboard()` 並回 `ResponseImpact.UPDATED`。
  - `AnswersResponse implements AwaitableResponse`：`getId()`、`getAwaitableId()`、`getTimestamp()`、`persistent()=false`、`answers()`；建構子 `AnswersResponse(String awaitableId, List<Answer> answers)`。

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.agent;

import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.Blackboard;
import com.embabel.agent.core.hitl.ResponseImpact;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 使用者回答送達後，UserAnswers 必須被放進 blackboard 讓 GOAP 繼續規劃。 */
class QuestionsAwaitableTest {
    @Test
    void onResponseBindsUserAnswersToBlackboard() {
        var awaitable = new QuestionsAwaitable(List.of(new Question("q1", "Dashcam?", "causation")));
        var blackboard = mock(Blackboard.class);
        var process = mock(AgentProcess.class);
        when(process.getBlackboard()).thenReturn(blackboard);

        var impact = awaitable.onResponse(new AnswersResponse(awaitable.getId(), List.of(new Answer("q1", "yes"))), process);

        assertEquals(ResponseImpact.UPDATED, impact);
        verify(blackboard).addObject(new UserAnswers(List.of(new Answer("q1", "yes"))));
        assertEquals(1, awaitable.questions().size());
        assertTrue(awaitable.getPayload().answers().isEmpty(), "payload 只是佔位，真正答案由 onResponse 寫入");
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest=QuestionsAwaitableTest` → 編譯錯誤。

- [ ] **Step 3: 實作**

`AnswersResponse.java`：
```java
package tw.lawgraph.agent;

import com.embabel.agent.core.hitl.AwaitableResponse;
import org.jetbrains.annotations.NotNull;
import tw.lawgraph.domain.Answer;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 使用者對頭腦風暴提問的回覆；對應某個 QuestionsAwaitable。 */
public final class AnswersResponse implements AwaitableResponse {
    private final String id = UUID.randomUUID().toString();
    private final String awaitableId;
    private final List<Answer> answers;
    private final Instant timestamp = Instant.now();

    public AnswersResponse(String awaitableId, List<Answer> answers) {
        this.awaitableId = awaitableId;
        this.answers = List.copyOf(answers);
    }
    public List<Answer> answers() { return answers; }
    @NotNull @Override public String getId() { return id; }
    @NotNull @Override public String getAwaitableId() { return awaitableId; }
    @NotNull @Override public Instant getTimestamp() { return timestamp; }
    @Override public boolean persistent() { return false; }
}
```

`QuestionsAwaitable.java`：
```java
package tw.lawgraph.agent;

import com.embabel.agent.core.AgentProcess;
import com.embabel.agent.core.hitl.AbstractAwaitable;
import com.embabel.agent.core.hitl.ResponseImpact;
import org.jetbrains.annotations.NotNull;
import tw.lawgraph.domain.Question;
import tw.lawgraph.domain.UserAnswers;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 讓流程停在 WAITING、等待人類回答頭腦風暴提問的等待物件。 */
public final class QuestionsAwaitable extends AbstractAwaitable<UserAnswers, AnswersResponse> {
    private final List<Question> questions;

    public QuestionsAwaitable(List<Question> questions) {
        super(new UserAnswers(List.of()), UUID.randomUUID().toString(), Instant.now(), false);
        this.questions = List.copyOf(questions);
    }
    /** 要呈現給使用者的問題清單。 */
    public List<Question> questions() { return questions; }

    @NotNull @Override
    public ResponseImpact onResponse(@NotNull AnswersResponse response, @NotNull AgentProcess agentProcess) {
        agentProcess.getBlackboard().addObject(new UserAnswers(response.answers()));
        return ResponseImpact.UPDATED;
    }
}
```

若編譯器指出 `AwaitableResponse`／`StableIdentified` 還有其他抽象成員（例如 `infoString`），依錯誤訊息補上最小實作；不要改測試。

- [ ] **Step 4: 測試通過** — `mvn -q test -Dtest=QuestionsAwaitableTest` → pass。

- [ ] **Step 5: Commit** — `git add src/main/java/tw/lawgraph/agent src/test/java/tw/lawgraph/agent; git commit -m "feat(agent): QuestionsAwaitable 與 AnswersResponse"`

---

### Task 5: Prompt 組裝 LegalPrompts

**Files:**
- Create: `src/main/java/tw/lawgraph/agent/LegalPrompts.java`
- Test: `src/test/java/tw/lawgraph/agent/LegalPromptsTest.java`

**Interfaces:**
- Produces（全部 `static String`）：
  - `system(Locale locale)`：共用 system prompt（工具名對映、dr-lawbot 不可用、提問改寫入 questions、Respond in、識別碼雙寫、免責）。
  - `brainstorm(CaseInput in)`、`research(CaseInput in, BrainstormResult b, UserAnswers a)`、`analyze(ResearchResult r, BrainstormResult b, Locale l)`、`buildGraph(CaseInput in, BrainstormResult b, ResearchResult r, AnalysisResult a)`。
  - 每個 user prompt 第一行固定 `Activate skill "<name>" and follow its steps <N–M>. Output only the requested object.`

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.agent;

import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Prompt 是技能與模型之間的契約，用字串斷言鎖住關鍵句。 */
class LegalPromptsTest {
    private final CaseInput in = new CaseInput("A rear-ended B at a crossing.", Locale.EN);

    @Test
    void systemPromptCarriesToolMappingLocaleAndCitationRule() {
        String s = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(s.contains("taiwan-legal-db:search_judgments"), "需說明技能內的前綴工具名對映到裸名");
        assertTrue(s.contains("dr-lawbot"), "需宣告 dr-lawbot 不可用並降級");
        assertTrue(s.contains("Respond in zh-TW"));
        assertTrue(s.contains("（"), "識別碼雙寫規則需含全形括號範例");
        assertTrue(s.contains("questions"), "技能要求詢問使用者時改寫入 questions[]");
    }

    @Test
    void everyUserPromptStartsWithActivateSentence() {
        var b = new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of());
        var r = new ResearchResult(List.of(), List.of(), List.of());
        var a = new AnalysisResult(List.of(), "", List.of(), "");
        assertTrue(LegalPrompts.brainstorm(in).startsWith("Activate skill \"legal-brainstorming\" and follow its steps 1–4."));
        assertTrue(LegalPrompts.research(in, b, new UserAnswers(List.of())).startsWith("Activate skill \"legal-research\" and follow its steps 1–4."));
        assertTrue(LegalPrompts.analyze(r, b, Locale.EN).startsWith("Activate skill \"legal-element-analysis\""));
        assertTrue(LegalPrompts.buildGraph(in, b, r, a).startsWith("Activate skill \"legal-graph\" and follow its steps 1–3."));
    }

    @Test
    void buildGraphPromptTellsModelToCopyRefAndJidVerbatim() {
        var r = new ResearchResult(List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "", "")), List.of(), List.of());
        String p = LegalPrompts.buildGraph(in, new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()), r,
            new AnalysisResult(List.of(), "", List.of(), ""));
        assertTrue(p.contains("民法第184條第1項"), "研究結果要原文列入 prompt 供複製");
        assertTrue(p.contains("\"ref\""), "需說明 law 節點的 ref 欄位");
        assertTrue(p.contains("\"jid\""), "需說明 judgment 節點的 jid 欄位");
        assertTrue(p.contains("do not set \"met\""), "met 由 Java 覆寫，模型不得自填");
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest=LegalPromptsTest`。

- [ ] **Step 3: 實作**

```java
package tw.lawgraph.agent;

import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.domain.*;

/** 各 Action 的 prompt 文字；純函式，方便測試與快取（system prompt 對所有 Action 相同）。 */
public final class LegalPrompts {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private LegalPrompts() {}

    /** 共用 system prompt：只放會改變模型行為的五件事。 */
    public static String system(Locale locale) {
        return """
            You are running the law-powers Taiwan legal skills inside a web service.
            1. Tool names: the skills refer to tools as `taiwan-legal-db:<tool>` (e.g. taiwan-legal-db:search_judgments). In this environment call the bare tool name `<tool>` (e.g. search_judgments).
            2. The `dr-lawbot` semantic search is NOT available. Follow the skills' degradation rule: use search_judgments keyword search only, and record "semantic search unavailable" in notes.
            3. Whenever a skill tells you to ask the user something, do NOT ask. Write each question into the `questions[]` output field instead (id, text, why). The human will answer on the web page.
            4. Respond in %s. Statute and judgment identifiers must always be written twice: an English label followed by the original Chinese in full-width parentheses, e.g. "Civil Code Art. 184 ¶1（民法第184條第1項）", "Supreme Court 108-Tai-Shang-2345（最高法院108年度台上字第2345號）". The Chinese part must be copied verbatim from tool results.
            5. Output is analysis support, not legal advice. Never invent statutes or case numbers.
            """.formatted(locale.code());
    }

    /** 步驟一～四：事實、法律關係、爭點、證據；提問寫入 questions。 */
    public static String brainstorm(CaseInput in) {
        return """
            Activate skill "legal-brainstorming" and follow its steps 1–4. Output only the requested object.
            Case description (locale %s):
            <case>%s</case>
            Fill facts, relations, issues, evidenceNeeds. Put every fact you still need from the user into questions[] (max 5, each with id q1..q5, text, why). Leave questions empty if the case is already sufficient.
            """.formatted(in.locale().code(), in.text());
    }

    /** 步驟一～四：關鍵詞、路由與工具呼叫、引用驗證、信任閘門；只能用檢索到的內容。 */
    public static String research(CaseInput in, BrainstormResult b, UserAnswers a) {
        return """
            Activate skill "legal-research" and follow its steps 1–4. Output only the requested object.
            Skip step 0 (environment check). Use the available tools; do not use dr-lawbot.
            <case>%s</case>
            <brainstorm>%s</brainstorm>
            <user_answers>%s</user_answers>
            For every law put the exact Chinese article reference you verified with query_regulation into `ref` (e.g. 民法第184條第1項) and the English label into `title`. For every judgment put the exact JID returned by search_judgments/get_judgment into `jid` and the full Chinese citation into `citation`. Anything you could not verify goes into notes, not into laws/judgments.
            """.formatted(in.text(), toJson(b), toJson(a));
    }

    /** 逐要件涵攝；met 只能是 yes/no/unknown 並附依據。 */
    public static String analyze(ResearchResult r, BrainstormResult b, Locale locale) {
        return """
            Activate skill "legal-element-analysis" and follow its steps 1–4. Output only the requested object.
            <research>%s</research>
            <brainstorm>%s</brainstorm>
            For each element: law (Chinese article ref copied from research), element name, met (yes|no|unknown), basis, fact. Respond in %s.
            """.formatted(toJson(r), toJson(b), locale.code());
    }

    /** 步驟一～三：節點、連線、組裝；ref/jid 逐字複製，met 不得自填。 */
    public static String buildGraph(CaseInput in, BrainstormResult b, ResearchResult r, AnalysisResult a) {
        return """
            Activate skill "legal-graph" and follow its steps 1–3. Output only the requested object (nodes, edges).
            <case>%s</case>
            <brainstorm>%s</brainstorm>
            <research>%s</research>
            <analysis>%s</analysis>
            Rules for this environment:
            - Every law node must carry "ref" copied verbatim from research.laws[].ref; every judgment node must carry "jid" copied verbatim from research.judgments[].jid. Nodes without a matching ref/jid will be deleted.
            - Element nodes: label must equal analysis.elements[].element exactly; do not set "met" (the server fills it from the analysis).
            - Edge "label" must be one of the skill's Chinese labels (適用, 引用, 上訴, 當事人, 證據, 要件, 該當, 抗辯/阻斷, 法條關聯, ...). Use "from"/"to" for endpoints.
            - Write node labels/descriptions in %s; identifiers keep the bilingual form.
            """.formatted(in.text(), toJson(b), toJson(r), toJson(a), in.locale().code());
    }

    private static String toJson(Object o) { return JSON.writeValueAsString(o); }
}
```

- [ ] **Step 4: 測試通過** — `mvn -q test -Dtest=LegalPromptsTest`。

- [ ] **Step 5: Commit** — `git add src/main/java/tw/lawgraph/agent/LegalPrompts.java src/test/java/tw/lawgraph/agent/LegalPromptsTest.java; git commit -m "feat(agent): LegalPrompts 五段 prompt 與共用 system prompt"`

---

### Task 6: Skills 與 ToolGroup 設定

**Files:**
- Create: `src/main/java/tw/lawgraph/agent/config/SkillsConfig.java`、`src/main/java/tw/lawgraph/agent/config/ToolGroupsConfig.java`
- Test: `src/test/java/tw/lawgraph/agent/config/SkillsConfigTest.java`、`src/test/java/tw/lawgraph/agent/config/ToolGroupsConfigTest.java`

**Interfaces:**
- Produces:
  - `@Bean Skills lawPowersSkills(@Value("${lawgraph.skills-dir}") String dir)`；`SkillsConfig.SKILL_NAMES = List.of("legal-brainstorming","legal-research","legal-element-analysis","legal-graph")`；`static Skills build(String dir)`（純函式供測試）。
  - `ToolGroupsConfig.LEGAL_DB = "taiwan-legal-db"`；`ToolGroupsConfig.ALLOWED_TOOLS`（六個）；`static boolean allowed(String toolName)`；`@Bean ToolGroup legalDbToolGroup(List<McpSyncClient> clients)`。

- [ ] **Step 1: 寫失敗測試**

`SkillsConfigTest.java`（直接對 submodule 目錄載入，驗證四個技能可被 loader 接受）：
```java
package tw.lawgraph.agent.config;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** law-powers 四個技能必須能被 embabel-agent-skills 的 loader 載入（含 references 檔案引用驗證）。 */
class SkillsConfigTest {
    @Test
    void loadsExactlyFourSkillsFromSubmodule() {
        Path dir = Path.of("skills/law-powers/skills");
        assumeTrue(Files.exists(dir.resolve("legal-graph/SKILL.md")), "submodule 未初始化");
        var skills = SkillsConfig.build(dir.toString());
        var names = skills.getSkills().stream().map(s -> s.getMetadata().getName()).sorted().toList();
        assertEquals(SkillsConfig.SKILL_NAMES.stream().sorted().toList(), names);
    }
}
```

`ToolGroupsConfigTest.java`：
```java
package tw.lawgraph.agent.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** 只暴露六個法律資料庫工具；憲法法庭工具刻意不開。 */
class ToolGroupsConfigTest {
    @Test
    void whitelistHasSixToolsAndExcludesInterpretations() {
        assertEquals(6, ToolGroupsConfig.ALLOWED_TOOLS.size());
        assertTrue(ToolGroupsConfig.allowed("search_judgments"));
        assertTrue(ToolGroupsConfig.allowed("get_citations"));
        assertFalse(ToolGroupsConfig.allowed("search_interpretations"));
        assertFalse(ToolGroupsConfig.allowed("get_interpretation"));
        assertEquals("taiwan-legal-db", ToolGroupsConfig.LEGAL_DB);
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest='SkillsConfigTest,ToolGroupsConfigTest'`。

- [ ] **Step 3: 實作**

`SkillsConfig.java`：
```java
package tw.lawgraph.agent.config;

import com.embabel.agent.skills.Skills;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.nio.file.Path;
import java.util.List;

/** 載入 law-powers 的四個技能，作為 LlmReference 掛進每個 Action 的 PromptRunner。 */
@Configuration
public class SkillsConfig {
    /** 只掛這四個；legal-writing-humanizer-workspace 無 SKILL.md，整目錄掃描會失敗。 */
    public static final List<String> SKILL_NAMES = List.of(
        "legal-brainstorming", "legal-research", "legal-element-analysis", "legal-graph");

    /** 純函式：依技能根目錄建立 Skills（供測試與 Bean 共用）。 */
    public static Skills build(String skillsDir) {
        Skills skills = new Skills("law-powers", "Taiwan legal analysis skills (law-powers)");
        for (String name : SKILL_NAMES) {
            skills = skills.withLocalSkill(Path.of(skillsDir, name).toString());
        }
        return skills;
    }

    @Bean
    public Skills lawPowersSkills(@Value("${lawgraph.skills-dir}") String skillsDir) {
        return build(skillsDir);
    }
}
```

`ToolGroupsConfig.java`：
```java
package tw.lawgraph.agent.config;

import com.embabel.agent.core.ToolGroup;
import com.embabel.agent.core.ToolGroupDescription;
import com.embabel.agent.core.ToolGroupPermission;
import com.embabel.agent.tools.mcp.McpToolGroup;
import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.List;
import java.util.Set;

/** 把 legal-mcp（mcp-taiwan-legal-db）包成 Embabel ToolGroup，只放行六個工具。 */
@Configuration
public class ToolGroupsConfig {
    public static final String LEGAL_DB = "taiwan-legal-db";
    public static final Set<String> ALLOWED_TOOLS = Set.of(
        "search_regulations", "query_regulation", "get_pcode", "search_judgments", "get_judgment", "get_citations");

    /** 工具白名單判斷。 */
    public static boolean allowed(String toolName) { return ALLOWED_TOOLS.contains(toolName); }

    @Bean
    public ToolGroup legalDbToolGroup(List<McpSyncClient> mcpSyncClients) {
        return new McpToolGroup(
            ToolGroupDescription.create("Taiwan statutes (law.moj.gov.tw) and court judgments (judicial.gov.tw) lookup", LEGAL_DB),
            "mcp-taiwan-legal-db",
            LEGAL_DB,
            Set.of(ToolGroupPermission.INTERNET_ACCESS),
            mcpSyncClients,
            callback -> allowed(callback.getToolDefinition().name()));
    }
}
```

若 `McpToolGroup` 六參數建構子在 Java 端不可見（Kotlin 預設參數未產生 overload），改為七參數並傳 `ToolCallContextMcpMetaConverter.passThrough()`（套件 `com.embabel.agent.tools.mcp`）。若 `getSkills()`／`getMetadata().getName()` 名稱不符，依 `Skills.kt`／`LoadedSkill` 實際 getter 調整測試中的呼叫，不改斷言意圖。

- [ ] **Step 4: 測試通過** — `mvn -q test -Dtest='SkillsConfigTest,ToolGroupsConfigTest'`。SkillsConfigTest 若因 SKILL.md 內引用檔案驗證失敗，先把失敗訊息記到 `logs/skills-validation.log`，改用 `new DefaultDirectorySkillDefinitionLoader(false)` 傳入 `Skills` 第四個參數（`validateFileReferences=false`），並在 README 的已知限制註明。

- [ ] **Step 5: Commit** — `git add src/main/java/tw/lawgraph/agent/config src/test/java/tw/lawgraph/agent/config; git commit -m "feat(agent): 載入 law-powers 四技能與 taiwan-legal-db ToolGroup"`

---

### Task 7: LegalGraphAgent（五個 @Action）

**Files:**
- Create: `src/main/java/tw/lawgraph/agent/LegalGraphAgent.java`
- Test: `src/test/java/tw/lawgraph/agent/LegalGraphAgentTest.java`

**Interfaces:**
- Consumes: `LegalPrompts`（Task 5）、`Skills` bean、`ToolGroupsConfig.LEGAL_DB`、`QuestionsAwaitable`、`GraphRules`。
- Produces: `@Agent(name = "LegalGraphAgent", description = ...) public class LegalGraphAgent`，建構子 `LegalGraphAgent(Skills skills)`；Action：
  - `BrainstormResult brainstorm(CaseInput, OperationContext)`
  - `UserAnswers askUser(BrainstormResult)`
  - `ResearchResult research(CaseInput, BrainstormResult, UserAnswers, OperationContext)`（`@Action(toolGroups = {ToolGroupsConfig.LEGAL_DB})`）
  - `AnalysisResult analyze(ResearchResult, BrainstormResult, CaseInput, OperationContext)`
  - `GraphOutcome buildGraph(CaseInput, BrainstormResult, ResearchResult, AnalysisResult, OperationContext)`（`@AchievesGoal`）
  - 常數 `AGENT_NAME = "LegalGraphAgent"`。

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.agent;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 以 Embabel 假 context 驗證：prompt 帶 activate 句、locale 落到 system prompt、buildGraph 套用硬規則、askUser 無問題時直接放行。 */
class LegalGraphAgentTest {
    private final Skills skills = new Skills("law-powers", "test skills");   // 空技能集即可，測的是流程不是模型
    private final LegalGraphAgent agent = new LegalGraphAgent(skills);
    private final CaseInput in = new CaseInput("A rear-ended B.", Locale.ZH_TW);
    private final BrainstormResult brainstorm = new BrainstormResult(List.of("f"), List.of(), List.of("i"), List.of(), List.of());
    private final ResearchResult research = new ResearchResult(
        List.of(new LawRef("民法第184條第1項", "Civil Code Art. 184 ¶1", "", "")), List.of(), List.of());
    private final AnalysisResult analysis = new AnalysisResult(
        List.of(new ElementFinding("民法第184條第1項", "相當因果關係", Met.unknown, "", "")), "", List.of(), "");

    @Test
    void brainstormUsesSkillActivationAndLocale() {
        var ctx = FakeOperationContext.create();
        ctx.expectResponse(brainstorm);
        var out = agent.brainstorm(in, ctx);
        assertEquals(brainstorm, out);
        var inv = ctx.getLlmInvocations().getFirst();
        assertTrue(inv.getPrompt().startsWith("Activate skill \"legal-brainstorming\""));
    }

    @Test
    void askUserReturnsEmptyAnswersWhenNoQuestions() {
        assertEquals(new UserAnswers(List.of()), agent.askUser(brainstorm));
    }

    @Test
    void buildGraphAppliesHardRules() {
        var ctx = FakeOperationContext.create();
        ctx.expectResponse(new GraphData(List.of(
            new GraphNode("l1", "law", "Civil Code Art. 184 ¶1（民法第184條第1項）", null, "民法第184條第1項", null, null, null, null, null, null, null, null, null),
            new GraphNode("l2", "law", "made up", null, "民法第1條", null, null, null, null, null, null, null, null, null),
            new GraphNode("e1", "element", "相當因果關係", null, null, null, "yes", null, null, null, null, null, null, null)),
            List.of(new GraphEdge("l1", "e1", "要件", null, null), new GraphEdge("l2", "e1", "要件", null, null))));
        var out = agent.buildGraph(in, brainstorm, research, analysis, ctx);
        assertEquals(2, out.graph().nodes().size());
        assertEquals("unknown", out.graph().nodes().get(1).met());
        assertEquals(1, out.graph().edges().size());
        assertEquals(1, out.notes().stream().filter(n -> n.startsWith("removed unverified law")).count());
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest=LegalGraphAgentTest`。

- [ ] **Step 3: 實作**

```java
package tw.lawgraph.agent;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.core.hitl.WaitFor;
import com.embabel.agent.skills.Skills;
import tw.lawgraph.agent.config.ToolGroupsConfig;
import tw.lawgraph.domain.*;
import java.util.List;

/**
 * 法律關係圖 Agent：案情 → 頭腦風暴 → 等使用者回答 → 檢索 → 涵攝 → 建圖。
 * 每個 Action 以型別串接，Embabel GOAP 自動依序規劃；askUser 不呼叫 LLM。
 */
@Agent(name = LegalGraphAgent.AGENT_NAME,
       description = "Turn a Taiwan legal case description into a verified legal relationship graph using law-powers skills")
public class LegalGraphAgent {
    public static final String AGENT_NAME = "LegalGraphAgent";
    private final Skills skills;

    public LegalGraphAgent(Skills skills) { this.skills = skills; }

    /** 步驟 1：事實、法律關係、爭點、證據需求與待問問題。 */
    @Action
    public BrainstormResult brainstorm(CaseInput input, OperationContext ctx) {
        return ctx.ai().withDefaultLlm()
            .withReference(skills)
            .withSystemPrompt(LegalPrompts.system(input.locale()))
            .createObject(LegalPrompts.brainstorm(input), BrainstormResult.class);
    }

    /** 步驟 2：有問題就停在 WAITING 等人回答；沒問題直接放行空答案。 */
    @Action
    public UserAnswers askUser(BrainstormResult brainstorm) {
        if (brainstorm.questions().isEmpty()) return new UserAnswers(List.of());
        return WaitFor.awaitable(new QuestionsAwaitable(brainstorm.questions()));
    }

    /** 步驤 3：以 taiwan-legal-db 檢索法條與判決，只保留可驗證的結果。 */
    @Action(toolGroups = {ToolGroupsConfig.LEGAL_DB})
    public ResearchResult research(CaseInput input, BrainstormResult brainstorm, UserAnswers answers, OperationContext ctx) {
        return ctx.ai().withDefaultLlm()
            .withReference(skills)
            .withToolGroup(ToolGroupsConfig.LEGAL_DB)
            .withSystemPrompt(LegalPrompts.system(input.locale()))
            .createObject(LegalPrompts.research(input, brainstorm, answers), ResearchResult.class);
    }

    /** 步驟 4：逐要件涵攝。 */
    @Action(toolGroups = {ToolGroupsConfig.LEGAL_DB})
    public AnalysisResult analyze(ResearchResult research, BrainstormResult brainstorm, CaseInput input, OperationContext ctx) {
        return ctx.ai().withDefaultLlm()
            .withReference(skills)
            .withToolGroup(ToolGroupsConfig.LEGAL_DB)
            .withSystemPrompt(LegalPrompts.system(input.locale()))
            .createObject(LegalPrompts.analyze(research, brainstorm, input.locale()), AnalysisResult.class);
    }

    /** 步驟 5：建圖並套用三條硬規則；達成目標。 */
    @AchievesGoal(description = "A verified legal relationship graph for the case")
    @Action
    public GraphOutcome buildGraph(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                  AnalysisResult analysis, OperationContext ctx) {
        GraphData raw = ctx.ai().withDefaultLlm()
            .withReference(skills)
            .withSystemPrompt(LegalPrompts.system(input.locale()))
            .createObject(LegalPrompts.buildGraph(input, brainstorm, research, analysis), GraphData.class);
        return GraphRules.apply(raw, research, analysis);
    }
}
```

若 `@Action` 沒有 `toolGroups` 屬性（編譯錯誤），移除該屬性，僅保留 `.withToolGroup(...)`（PromptRunner 端已宣告需求）。

- [ ] **Step 4: 測試通過** — `mvn -q test -Dtest=LegalGraphAgentTest`。

- [ ] **Step 5: Commit** — `git add src/main/java/tw/lawgraph/agent/LegalGraphAgent.java src/test/java/tw/lawgraph/agent/LegalGraphAgentTest.java; git commit -m "feat(agent): LegalGraphAgent 五個 Action 與 WaitFor 提問"`

---

### Task 8: CaseStatus、StatusMapper 與 RateLimiter

**Files:**
- Create: `src/main/java/tw/lawgraph/api/CaseStatus.java`、`StatusSnapshot.java`、`StatusMapper.java`、`RateLimiter.java`
- Test: `src/test/java/tw/lawgraph/api/StatusMapperTest.java`、`RateLimiterTest.java`

**Interfaces:**
- Produces:
  - `record CaseStatus(String caseId, String status, String step, String locale, List<Question> questions, Result result, ErrorInfo error)`；`record Result(BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, GraphData graph)`；`record ErrorInfo(String code, String message, String step)`。`@JsonInclude(NON_NULL)`。
  - `record StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code, BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers, ResearchResult research, AnalysisResult analysis, GraphOutcome outcome, String failure)`
  - `StatusMapper.map(StatusSnapshot) -> CaseStatus`：
    - `COMPLETED` 且 outcome≠null → status COMPLETED / step GRAPH / result（research.notes ＝ 原 notes ＋ outcome.notes）
    - `WAITING` → status WAITING / step QUESTIONS / questions
    - `FAILED|TERMINATED|KILLED|STUCK` → FAILED，error.step ＝ 推導步驟
    - 其他 → RUNNING；step 推導：analysis≠null→GRAPH；research≠null→ANALYSIS；answers≠null→RESEARCH；brainstorm≠null→QUESTIONS；否則 BRAINSTORM
  - `RateLimiter(int maxPerHour, Clock clock)`；`boolean tryAcquire(String key)`。

- [ ] **Step 1: 寫失敗測試**

`StatusMapperTest.java`：
```java
package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import org.junit.jupiter.api.Test;
import tw.lawgraph.domain.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** 前端與 Agent 都靠 CaseStatus 判斷下一步，狀態與步驟推導必須確定。 */
class StatusMapperTest {
    private final BrainstormResult b = new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of(new Question("q1", "?", "why")));
    private final ResearchResult r = new ResearchResult(List.of(), List.of(), List.of("semantic search unavailable"));
    private final AnalysisResult a = new AnalysisResult(List.of(), "", List.of(), "");
    private final GraphOutcome g = new GraphOutcome(new GraphData(List.of(), List.of()), List.of("removed edge: x->y (bad)"));

    private StatusSnapshot snap(AgentProcessStatusCode code, BrainstormResult b, List<Question> q, UserAnswers ua, ResearchResult r, AnalysisResult a, GraphOutcome g) {
        return new StatusSnapshot("c1", Locale.EN, code, b, q, ua, r, a, g, null);
    }

    @Test void runningBeforeBrainstorm() {
        var s = StatusMapper.map(snap(AgentProcessStatusCode.RUNNING, null, null, null, null, null, null));
        assertEquals("RUNNING", s.status()); assertEquals("BRAINSTORM", s.step()); assertNull(s.result());
    }
    @Test void waitingExposesQuestions() {
        var s = StatusMapper.map(snap(AgentProcessStatusCode.WAITING, b, b.questions(), null, null, null, null));
        assertEquals("WAITING", s.status()); assertEquals("QUESTIONS", s.step()); assertEquals(1, s.questions().size());
    }
    @Test void runningAfterAnswersIsResearchStep() {
        var s = StatusMapper.map(snap(AgentProcessStatusCode.RUNNING, b, null, new UserAnswers(List.of()), null, null, null));
        assertEquals("RESEARCH", s.step());
    }
    @Test void completedMergesNotes() {
        var s = StatusMapper.map(snap(AgentProcessStatusCode.COMPLETED, b, null, new UserAnswers(List.of()), r, a, g));
        assertEquals("COMPLETED", s.status()); assertEquals("GRAPH", s.step());
        assertEquals(List.of("semantic search unavailable", "removed edge: x->y (bad)"), s.result().research().notes());
        assertNotNull(s.result().graph());
    }
    @Test void failedCarriesStep() {
        var snap = new StatusSnapshot("c1", Locale.EN, AgentProcessStatusCode.FAILED, b, null, new UserAnswers(List.of()), r, null, null, "boom");
        var s = StatusMapper.map(snap);
        assertEquals("FAILED", s.status()); assertEquals("ANALYSIS", s.error().step()); assertEquals("boom", s.error().message());
    }
}
```

`RateLimiterTest.java`：
```java
package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

/** 每 IP 每小時 N 次的滑動視窗限流。 */
class RateLimiterTest {
    @Test
    void allowsUpToLimitThenBlocksUntilWindowSlides() {
        var clock = new MutableClock(Instant.parse("2026-08-30T00:00:00Z"));
        var limiter = new RateLimiter(2, clock);
        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertFalse(limiter.tryAcquire("1.1.1.1"));
        assertTrue(limiter.tryAcquire("2.2.2.2"), "不同 key 互不影響");
        clock.advance(Duration.ofMinutes(61));
        assertTrue(limiter.tryAcquire("1.1.1.1"));
    }

    /** 測試用可推進時鐘。 */
    static final class MutableClock extends Clock {
        private Instant now;
        MutableClock(Instant start) { this.now = start; }
        void advance(Duration d) { now = now.plus(d); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest='StatusMapperTest,RateLimiterTest'`。

- [ ] **Step 3: 實作**

`CaseStatus.java`：
```java
package tw.lawgraph.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import tw.lawgraph.domain.*;
import java.util.List;

/** 唯一的狀態回傳型別：前端輪詢與 WebMCP getCaseStatus 共用。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CaseStatus(String caseId, String status, String step, String locale,
                         List<Question> questions, Result result, ErrorInfo error) {
    /** COMPLETED 時的四段結果。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Result(BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, GraphData graph) {}
    /** FAILED 時的錯誤資訊。 */
    public record ErrorInfo(String code, String message, String step) {}
}
```

`StatusSnapshot.java`：
```java
package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import tw.lawgraph.domain.*;
import java.util.List;

/** 從 AgentProcess blackboard 擷取的純資料快照，讓 StatusMapper 可以不依賴 Embabel 介面測試。 */
public record StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                             BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                             ResearchResult research, AnalysisResult analysis, GraphOutcome outcome, String failure) {}
```

`StatusMapper.java`：
```java
package tw.lawgraph.api;

import com.embabel.agent.core.AgentProcessStatusCode;
import tw.lawgraph.domain.ResearchResult;
import java.util.ArrayList;
import java.util.List;

/** 把 Embabel 流程狀態換成前端契約 CaseStatus。 */
public final class StatusMapper {
    private StatusMapper() {}

    public static CaseStatus map(StatusSnapshot s) {
        String step = deriveStep(s);
        switch (s.code()) {
            case COMPLETED -> {
                if (s.outcome() != null) {
                    List<String> notes = new ArrayList<>(s.research().notes());
                    notes.addAll(s.outcome().notes());
                    var research = new ResearchResult(s.research().laws(), s.research().judgments(), notes);
                    return new CaseStatus(s.caseId(), "COMPLETED", "GRAPH", s.locale().code(), null,
                        new CaseStatus.Result(s.brainstorm(), research, s.analysis(), s.outcome().graph()), null);
                }
                return failed(s, "COMPLETED_WITHOUT_GRAPH", "process completed without a graph", step);
            }
            case WAITING -> {
                return new CaseStatus(s.caseId(), "WAITING", "QUESTIONS", s.locale().code(), s.pendingQuestions(), null, null);
            }
            case FAILED, TERMINATED, KILLED, STUCK -> {
                return failed(s, s.code().name(), s.failure() == null ? "agent process " + s.code().name().toLowerCase() : s.failure(), step);
            }
            default -> {
                return new CaseStatus(s.caseId(), "RUNNING", step, s.locale().code(), null, null, null);
            }
        }
    }

    /** 依 blackboard 已有的產物推導目前步驟。 */
    static String deriveStep(StatusSnapshot s) {
        if (s.analysis() != null) return "GRAPH";
        if (s.research() != null) return "ANALYSIS";
        if (s.answers() != null) return "RESEARCH";
        if (s.brainstorm() != null) return "QUESTIONS";
        return "BRAINSTORM";
    }

    private static CaseStatus failed(StatusSnapshot s, String code, String message, String step) {
        return new CaseStatus(s.caseId(), "FAILED", step, s.locale().code(), null, null, new CaseStatus.ErrorInfo(code, message, step));
    }
}
```

`RateLimiter.java`：
```java
package tw.lawgraph.api;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 每個 key（IP）一小時內最多 N 次的滑動視窗限流；記憶體實作，重啟歸零。 */
public final class RateLimiter {
    private final int maxPerHour;
    private final Clock clock;
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public RateLimiter(int maxPerHour, Clock clock) { this.maxPerHour = maxPerHour; this.clock = clock; }

    /** 嘗試取得一次配額；成功回 true。 */
    public synchronized boolean tryAcquire(String key) {
        Instant now = clock.instant();
        Deque<Instant> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!q.isEmpty() && q.peekFirst().isBefore(now.minus(Duration.ofHours(1)))) q.pollFirst();
        if (q.size() >= maxPerHour) return false;
        q.addLast(now);
        return true;
    }
}
```

- [ ] **Step 4: 測試通過** — `mvn -q test -Dtest='StatusMapperTest,RateLimiterTest'`。

- [ ] **Step 5: Commit** — `git add src/main/java/tw/lawgraph/api src/test/java/tw/lawgraph/api; git commit -m "feat(api): CaseStatus 契約、StatusMapper 與 RateLimiter"`

---

### Task 9: CaseService、CaseController 與例外處理

**Files:**
- Create: `src/main/java/tw/lawgraph/api/CaseService.java`、`CaseController.java`、`ApiExceptionHandler.java`、`CaseNotFoundException.java`、`CaseNotWaitingException.java`
- Test: `src/test/java/tw/lawgraph/api/CaseServiceTest.java`、`src/test/java/tw/lawgraph/api/CaseControllerTest.java`

**Interfaces:**
- Consumes: `AgentPlatform`（Embabel bean）、`LegalGraphAgent.AGENT_NAME`、`QuestionsAwaitable`、`AnswersResponse`、`StatusMapper`、`RateLimiter`。
- Produces:
  - `CaseService.start(String text, Locale locale) -> CaseStatus`
  - `CaseService.status(String caseId) -> CaseStatus`（不存在丟 `CaseNotFoundException`）
  - `CaseService.answer(String caseId, List<Answer>) -> CaseStatus`（非 WAITING 丟 `CaseNotWaitingException`）
  - REST：`POST /api/cases {caseText, locale}` → 201；`GET /api/cases/{id}`；`POST /api/cases/{id}/answers {answers:[{questionId, answer}]}`；404／409／429 以 `{"error":"...", "message":"..."}` 回。
  - `@Bean RateLimiter rateLimiter(@Value("${lawgraph.rate-limit-per-hour}") int n)` 定義於 `CaseController` 所在套件的 `ApiConfig`（同檔 `CaseService.java` 下方一個 `@Configuration` 也可）。

- [ ] **Step 1: 寫失敗測試（Service，用 Mockito 假 AgentPlatform）**

```java
package tw.lawgraph.api;

import com.embabel.agent.core.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.agent.QuestionsAwaitable;
import tw.lawgraph.domain.*;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** CaseService 是 REST 與 Embabel 之間唯一的黏合層。 */
class CaseServiceTest {
    AgentPlatform platform = mock(AgentPlatform.class);
    Agent agent = mock(Agent.class);
    AgentProcess process = mock(AgentProcess.class);
    Blackboard blackboard = mock(Blackboard.class);
    CaseService service;

    @BeforeEach void setUp() {
        when(agent.getName()).thenReturn(LegalGraphAgent.AGENT_NAME);
        when(platform.agents()).thenReturn(List.of(agent));
        when(platform.createAgentProcessFrom(eq(agent), any(ProcessOptions.class), any())).thenReturn(process);
        when(platform.getAgentProcess("p1")).thenReturn(process);
        when(platform.start(process)).thenReturn(CompletableFuture.completedFuture(process));
        when(process.getId()).thenReturn("p1");
        when(process.getBlackboard()).thenReturn(blackboard);
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.RUNNING);
        service = new CaseService(platform);
    }

    @Test void startCreatesProcessBindsCaseInputAndStartsAsync() {
        var status = service.start("A hit B", Locale.ZH_TW);
        assertEquals("p1", status.caseId());
        assertEquals("RUNNING", status.status());
        assertEquals("zh-TW", status.locale());
        verify(platform).createAgentProcessFrom(eq(agent), any(ProcessOptions.class), eq(new CaseInput("A hit B", Locale.ZH_TW)));
        verify(platform).start(process);
    }

    @Test void statusUnknownIdThrows404() {
        assertThrows(CaseNotFoundException.class, () -> service.status("nope"));
    }

    @Test void answerWhenNotWaitingThrows409() {
        service.start("x", Locale.EN);
        assertThrows(CaseNotWaitingException.class, () -> service.answer("p1", List.of(new Answer("q1", "yes"))));
    }

    @Test void answerWhenWaitingFeedsAwaitableAndResumes() {
        service.start("x", Locale.EN);
        var awaitable = new QuestionsAwaitable(List.of(new Question("q1", "?", "why")));
        when(process.getStatus()).thenReturn(AgentProcessStatusCode.WAITING);
        when(blackboard.last(QuestionsAwaitable.class)).thenReturn(awaitable);
        var status = service.answer("p1", List.of(new Answer("q1", "yes")));
        verify(blackboard).addObject(new UserAnswers(List.of(new Answer("q1", "yes"))));
        verify(platform, times(2)).start(process);
        assertNotNull(status);
    }
}
```

- [ ] **Step 2: 寫失敗測試（Controller，`@WebMvcTest`）**

```java
package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import tw.lawgraph.domain.Locale;
import java.time.Clock;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/** REST 契約：狀態碼、JSON 形狀、限流。 */
@WebMvcTest(controllers = CaseController.class)
@Import(CaseControllerTest.TestBeans.class)
class CaseControllerTest {
    @Autowired MockMvcTester mvc;
    @MockitoBean CaseService service;

    @TestConfiguration
    static class TestBeans {
        @Bean RateLimiter rateLimiter() { return new RateLimiter(2, Clock.systemUTC()); }
    }

    private CaseStatus running() { return new CaseStatus("p1", "RUNNING", "BRAINSTORM", "en", null, null, null); }

    @Test void postCasesReturns201WithStatus() {
        when(service.start("A hit B", Locale.EN)).thenReturn(running());
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"A hit B\",\"locale\":\"en\"}"))
            .hasStatus(201).bodyJson().extractingPath("$.caseId").isEqualTo("p1");
    }

    @Test void thirdPostFromSameIpIs429() {
        when(service.start(anyString(), any())).thenReturn(running());
        String body = "{\"caseText\":\"x\",\"locale\":\"en\"}";
        mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON).content(body)).hasStatus(429);
    }

    @Test void unknownCaseIs404() {
        when(service.status("nope")).thenThrow(new CaseNotFoundException("nope"));
        assertThat(mvc.get().uri("/api/cases/nope")).hasStatus(404).bodyJson().extractingPath("$.error").isEqualTo("CASE_NOT_FOUND");
    }

    @Test void answersWhenNotWaitingIs409() {
        when(service.answer(eq("p1"), anyList())).thenThrow(new CaseNotWaitingException("p1"));
        assertThat(mvc.post().uri("/api/cases/p1/answers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"answers\":[{\"questionId\":\"q1\",\"answer\":\"yes\"}]}"))
            .hasStatus(409);
    }

    @Test void blankCaseTextIs400() {
        assertThat(mvc.post().uri("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"caseText\":\"  \",\"locale\":\"en\"}")).hasStatus(400);
    }
}
```

- [ ] **Step 3: 執行確認失敗** — `mvn -q test -Dtest='CaseServiceTest,CaseControllerTest'`。

- [ ] **Step 4: 實作**

`CaseNotFoundException.java`／`CaseNotWaitingException.java`：
```java
package tw.lawgraph.api;
/** 找不到 caseId。 */
public class CaseNotFoundException extends RuntimeException {
    public CaseNotFoundException(String id) { super("case not found: " + id); }
}
```
```java
package tw.lawgraph.api;
/** 流程不在 WAITING 卻收到回答。 */
public class CaseNotWaitingException extends RuntimeException {
    public CaseNotWaitingException(String id) { super("case is not waiting for answers: " + id); }
}
```

`CaseService.java`：
```java
package tw.lawgraph.api;

import com.embabel.agent.core.*;
import org.springframework.stereotype.Service;
import tw.lawgraph.agent.AnswersResponse;
import tw.lawgraph.agent.LegalGraphAgent;
import tw.lawgraph.agent.QuestionsAwaitable;
import tw.lawgraph.domain.*;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 啟動、查詢、續行 LegalGraphAgent 流程；狀態只存記憶體，caseId 就是 Embabel processId。 */
@Service
public class CaseService {
    private final AgentPlatform platform;
    /** caseId → 建立時的語系（blackboard 不方便反查 Locale，另存一份）。 */
    private final Map<String, Locale> locales = new ConcurrentHashMap<>();

    public CaseService(AgentPlatform platform) { this.platform = platform; }

    /** 建立流程並非同步啟動。 */
    public CaseStatus start(String text, Locale locale) {
        Agent agent = platform.agents().stream()
            .filter(a -> LegalGraphAgent.AGENT_NAME.equals(a.getName()))
            .findFirst().orElseThrow(() -> new IllegalStateException("LegalGraphAgent not deployed"));
        AgentProcess process = platform.createAgentProcessFrom(agent, new ProcessOptions(), new CaseInput(text, locale));
        locales.put(process.getId(), locale);
        platform.start(process);
        return status(process.getId());
    }

    /** 讀取目前狀態。 */
    public CaseStatus status(String caseId) {
        AgentProcess p = platform.getAgentProcess(caseId);
        if (p == null || !locales.containsKey(caseId)) throw new CaseNotFoundException(caseId);
        return StatusMapper.map(snapshot(caseId, p));
    }

    /** 把使用者回答交給等待物件並恢復流程。 */
    public CaseStatus answer(String caseId, List<Answer> answers) {
        AgentProcess p = platform.getAgentProcess(caseId);
        if (p == null || !locales.containsKey(caseId)) throw new CaseNotFoundException(caseId);
        if (p.getStatus() != AgentProcessStatusCode.WAITING) throw new CaseNotWaitingException(caseId);
        QuestionsAwaitable awaitable = p.getBlackboard().last(QuestionsAwaitable.class);
        if (awaitable == null) throw new CaseNotWaitingException(caseId);
        awaitable.onResponse(new AnswersResponse(awaitable.getId(), answers), p);
        platform.start(p);
        return status(caseId);
    }

    /** 從 blackboard 擷取各階段產物；WAITING 時附上待答問題。 */
    private StatusSnapshot snapshot(String caseId, AgentProcess p) {
        Blackboard bb = p.getBlackboard();
        QuestionsAwaitable aw = bb.last(QuestionsAwaitable.class);
        List<Question> pending = (p.getStatus() == AgentProcessStatusCode.WAITING && aw != null) ? aw.questions() : null;
        Object failure = p.getFailureInfo();
        return new StatusSnapshot(caseId, locales.get(caseId), p.getStatus(),
            bb.last(BrainstormResult.class), pending, bb.last(UserAnswers.class),
            bb.last(ResearchResult.class), bb.last(AnalysisResult.class), bb.last(GraphOutcome.class),
            failure == null ? null : failure.toString());
    }
}
```

`CaseController.java`：
```java
package tw.lawgraph.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tw.lawgraph.domain.Answer;
import tw.lawgraph.domain.Locale;
import java.time.Clock;
import java.util.List;

/** 案件流程 REST 端點。 */
@RestController
@RequestMapping("/api/cases")
public class CaseController {
    /** 啟動請求。 */
    public record StartRequest(String caseText, String locale) {}
    /** 回答請求。 */
    public record AnswersRequest(List<Answer> answers) {}

    private final CaseService service;
    private final RateLimiter limiter;

    public CaseController(CaseService service, RateLimiter limiter) { this.service = service; this.limiter = limiter; }

    @PostMapping
    public ResponseEntity<?> start(@RequestBody StartRequest req, HttpServletRequest http) {
        if (req.caseText() == null || req.caseText().isBlank()) {
            return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "caseText must not be blank"));
        }
        if (!limiter.tryAcquire(clientIp(http))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(ApiExceptionHandler.error("RATE_LIMITED", "max cases per hour reached"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(service.start(req.caseText().trim(), Locale.fromCode(req.locale())));
    }

    @GetMapping("/{id}")
    public CaseStatus status(@PathVariable String id) { return service.status(id); }

    @PostMapping("/{id}/answers")
    public CaseStatus answers(@PathVariable String id, @RequestBody AnswersRequest req) {
        return service.answer(id, req.answers() == null ? List.of() : req.answers());
    }

    /** 取客戶端 IP：Cloudflare Tunnel 後面優先讀 CF-Connecting-IP。 */
    private static String clientIp(HttpServletRequest http) {
        String cf = http.getHeader("CF-Connecting-IP");
        return cf != null ? cf : http.getRemoteAddr();
    }

    /** 限流 Bean。 */
    @Configuration
    static class ApiConfig {
        @Bean RateLimiter rateLimiter(@Value("${lawgraph.rate-limit-per-hour:10}") int perHour) {
            return new RateLimiter(perHour, Clock.systemUTC());
        }
    }
}
```

`ApiExceptionHandler.java`：
```java
package tw.lawgraph.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

/** 統一錯誤 JSON：{error, message}。 */
@RestControllerAdvice
public class ApiExceptionHandler {
    static Map<String, String> error(String code, String message) { return Map.of("error", code, "message", message); }

    @ExceptionHandler(CaseNotFoundException.class) @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> notFound(CaseNotFoundException e) { return error("CASE_NOT_FOUND", e.getMessage()); }

    @ExceptionHandler(CaseNotWaitingException.class) @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> conflict(CaseNotWaitingException e) { return error("CASE_NOT_WAITING", e.getMessage()); }
}
```

若 `@WebMvcTest` 因 Embabel 自動設定被拉進來而啟動失敗，在測試類加 `@ActiveProfiles("test")` 並確認 `application-test.yml` 關閉 MCP；仍失敗則改 `@WebMvcTest(controllers = CaseController.class, excludeAutoConfiguration = {...})` 排除 Embabel 的 autoconfigure 類（從錯誤訊息取名稱）。

- [ ] **Step 5: 測試通過** — `mvn -q test -Dtest='CaseServiceTest,CaseControllerTest'`。

- [ ] **Step 6: Commit** — `git add src/main/java/tw/lawgraph/api src/test/java/tw/lawgraph/api; git commit -m "feat(api): CaseService 與 /api/cases 端點（404/409/429）"`

---

### Task 10: 示範案例與引用驗證端點

**Files:**
- Create: `src/main/resources/samples/en.json`、`src/main/resources/samples/zh-TW.json`、`src/main/java/tw/lawgraph/api/SampleCase.java`、`SamplesController.java`、`CitationVerifier.java`、`VerifyController.java`
- Test: `src/test/java/tw/lawgraph/api/SamplesControllerTest.java`、`CitationVerifierTest.java`

**Interfaces:**
- Produces:
  - `record SampleCase(String id, String title, String summary, String text)`；`GET /api/samples?locale=` 回 4 筆；未知 locale 回英文。
  - `CitationVerifier.parse(String ref) -> Target`（`record Target(Kind kind, String lawName, String articleNo, String judgmentKeyword)`，`enum Kind { LAW, JUDGMENT, UNKNOWN }`）純函式；`CitationVerifier.verify(String ref) -> Verification`（`record Verification(String ref, boolean exists, String source, String snippet)`）呼叫 MCP。
  - `GET /api/laws/verify?ref=` 回 `Verification`；`ref` 空白 → 400。

- [ ] **Step 1: 寫失敗測試**

`SamplesControllerTest.java`：
```java
package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import static org.assertj.core.api.Assertions.assertThat;

/** 四個示範案例，兩種語系，id 一致。 */
@WebMvcTest(controllers = SamplesController.class)
class SamplesControllerTest {
    @Autowired MockMvcTester mvc;

    @Test void returnsFourSamplesPerLocaleWithStableIds() {
        assertThat(mvc.get().uri("/api/samples?locale=zh-TW")).hasStatusOk()
            .bodyJson().extractingPath("$.length()").isEqualTo(4);
        assertThat(mvc.get().uri("/api/samples?locale=en")).hasStatusOk()
            .bodyJson().extractingPath("$[0].id").isEqualTo("settop-box");
        assertThat(mvc.get().uri("/api/samples?locale=xx")).hasStatusOk()
            .bodyJson().extractingPath("$[0].id").isEqualTo("settop-box");
    }
}
```

`CitationVerifierTest.java`（只測解析純函式）：
```java
package tw.lawgraph.api;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** 條號／字號解析決定要打哪個 MCP 工具。 */
class CitationVerifierTest {
    @Test void parsesStatuteWithArticleAndParagraph() {
        var t = CitationVerifier.parse("民法第184條第1項");
        assertEquals(CitationVerifier.Kind.LAW, t.kind());
        assertEquals("民法", t.lawName());
        assertEquals("184", t.articleNo());
    }
    @Test void parsesBilingualFormUsingChinesePart() {
        var t = CitationVerifier.parse("Civil Code Art. 217（民法第217條）");
        assertEquals("民法", t.lawName()); assertEquals("217", t.articleNo());
    }
    @Test void parsesJudgmentCitation() {
        var t = CitationVerifier.parse("最高法院108年度台上字第2345號");
        assertEquals(CitationVerifier.Kind.JUDGMENT, t.kind());
        assertEquals("最高法院 108 台上 2345", t.judgmentKeyword());
    }
    @Test void unknownWhenNothingMatches() {
        assertEquals(CitationVerifier.Kind.UNKNOWN, CitationVerifier.parse("hello").kind());
    }
}
```

- [ ] **Step 2: 執行確認失敗** — `mvn -q test -Dtest='SamplesControllerTest,CitationVerifierTest'`。

- [ ] **Step 3: 實作示範案例資料**

`samples/en.json`（`zh-TW.json` 同 id、同結構，內容為繁中）。四案 id：`settop-box`、`car-accident`、`rental-deposit`、`probation-dismissal`。每案 `text` 200–300 字、**刻意留白**（車禍不寫行車紀錄器；租屋不寫押金收據；解僱不寫預告期；機上盒不寫銷售數量），summary 一句。英文版範例（其餘三案依同格式撰寫，內容依 spec 6.5 節）：
```json
[
  {
    "id": "settop-box",
    "title": "Set-top box public transmission",
    "summary": "A distributor sold Android boxes preloaded with apps streaming TV channels without licence.",
    "text": "Between 2020 and 2021, Company X (a Taiwanese trading company) imported and sold about 3,000 Android set-top boxes preloaded with an app that let buyers watch 200+ local TV channels for free. A coalition of three broadcasters says the app pulled streams from unlicensed servers and that X advertised 'watch everything free forever'. X says it only sold hardware and the app was installed by a Hong Kong supplier. The broadcasters filed a criminal complaint and want civil damages. The district court convicted the CEO; X appealed. We represent the broadcasters."
  }
]
```

- [ ] **Step 4: 實作 Java**

`SampleCase.java`／`SamplesController.java`：
```java
package tw.lawgraph.api;

/** 一鍵帶入的示範案例（皆為虛構）。 */
public record SampleCase(String id, String title, String summary, String text) {}
```
```java
package tw.lawgraph.api;

import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.domain.Locale;
import java.io.IOException;
import java.util.List;

/** 依語系回傳示範案例；檔案在 classpath:samples/<locale>.json，啟動時一次讀入。 */
@RestController
public class SamplesController {
    private final List<SampleCase> en;
    private final List<SampleCase> zhTw;

    public SamplesController() throws IOException {
        JsonMapper m = JsonMapper.builder().build();
        en = List.of(m.readValue(new ClassPathResource("samples/en.json").getInputStream(), SampleCase[].class));
        zhTw = List.of(m.readValue(new ClassPathResource("samples/zh-TW.json").getInputStream(), SampleCase[].class));
    }

    @GetMapping("/api/samples")
    public List<SampleCase> samples(@RequestParam(required = false) String locale) {
        return Locale.fromCode(locale) == Locale.ZH_TW ? zhTw : en;
    }
}
```

`CitationVerifier.java`：
```java
package tw.lawgraph.api;

import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 條號／字號存在性驗證：解析 → 呼叫 taiwan-legal-db 對應工具。 */
@Service
public class CitationVerifier {
    public enum Kind { LAW, JUDGMENT, UNKNOWN }
    public record Target(Kind kind, String lawName, String articleNo, String judgmentKeyword) {}
    public record Verification(String ref, boolean exists, String source, String snippet) {}

    private static final Pattern LAW = Pattern.compile("([\\u4e00-\\u9fff]{2,20}?)第(\\d+(?:-\\d+)?)條");
    private static final Pattern JUDGMENT = Pattern.compile("([\\u4e00-\\u9fff]+法院)(\\d+)年度([\\u4e00-\\u9fff]+)字第(\\d+)號");
    private final List<McpSyncClient> clients;

    public CitationVerifier(List<McpSyncClient> clients) { this.clients = clients; }

    /** 純解析：先找字號，再找條號（字號含「法院」不會被條號誤判）。 */
    public static Target parse(String ref) {
        if (ref == null) return new Target(Kind.UNKNOWN, null, null, null);
        Matcher j = JUDGMENT.matcher(ref);
        if (j.find()) return new Target(Kind.JUDGMENT, null, null, j.group(1) + " " + j.group(2) + " " + j.group(3) + " " + j.group(4));
        Matcher l = LAW.matcher(ref);
        if (l.find()) return new Target(Kind.LAW, l.group(1), l.group(2), null);
        return new Target(Kind.UNKNOWN, null, null, null);
    }

    /** 呼叫 MCP 工具驗證；任何例外視為不存在並把訊息放進 snippet。 */
    public Verification verify(String ref) {
        Target t = parse(ref);
        if (t.kind() == Kind.UNKNOWN || clients.isEmpty()) return new Verification(ref, false, null, "unrecognised reference");
        try {
            McpSchema.CallToolResult result = switch (t.kind()) {
                case LAW -> clients.getFirst().callTool(new McpSchema.CallToolRequest("query_regulation",
                    Map.of("law_name", t.lawName(), "article_no", t.articleNo())));
                case JUDGMENT -> clients.getFirst().callTool(new McpSchema.CallToolRequest("search_judgments",
                    Map.of("keyword", t.judgmentKeyword())));
                default -> throw new IllegalStateException();
            };
            String text = result.content().stream().filter(c -> c instanceof McpSchema.TextContent)
                .map(c -> ((McpSchema.TextContent) c).text()).findFirst().orElse("");
            boolean exists = !Boolean.TRUE.equals(result.isError()) && !text.isBlank() && !text.contains("\"error\"");
            String source = t.kind() == Kind.LAW ? "law.moj.gov.tw" : "judgment.judicial.gov.tw";
            return new Verification(ref, exists, source, text.length() > 300 ? text.substring(0, 300) : text);
        } catch (RuntimeException e) {
            return new Verification(ref, false, null, "lookup failed: " + e.getMessage());
        }
    }
}
```

`VerifyController.java`：
```java
package tw.lawgraph.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** WebMCP verifyCitation 工具的後端。 */
@RestController
public class VerifyController {
    private final CitationVerifier verifier;
    public VerifyController(CitationVerifier verifier) { this.verifier = verifier; }

    @GetMapping("/api/laws/verify")
    public ResponseEntity<?> verify(@RequestParam String ref) {
        if (ref.isBlank()) return ResponseEntity.badRequest().body(ApiExceptionHandler.error("INVALID_INPUT", "ref must not be blank"));
        return ResponseEntity.ok(verifier.verify(ref.trim()));
    }
}
```

若 MCP Java SDK 的類別名與上面不同（Spring AI 2.0 綁定的 `io.modelcontextprotocol.sdk` 版本），以編譯錯誤為準修正 `CallToolRequest`／`CallToolResult`／`TextContent` 的套件與存取子名稱；不得改變 `Verification` 契約。

- [ ] **Step 5: 測試通過** — `mvn -q test -Dtest='SamplesControllerTest,CitationVerifierTest'`，再跑全套 `mvn -q test 2>&1 | Tee-Object -FilePath logs/task10-test.log` 確認前面任務仍綠。

- [ ] **Step 6: Commit** — `git add src/main/resources/samples src/main/java/tw/lawgraph/api src/test/java/tw/lawgraph/api; git commit -m "feat(api): 示範案例端點與引用驗證端點"`

---

### Task 11: legal-mcp sidecar、docker-compose 與 MCP 整合測試

**Files:**
- Create: `docker/legal-mcp/Dockerfile`、`docker/legal-mcp/requirements.txt`、`docker/app/Dockerfile`、`docker-compose.yml`、`.env.example`
- Test: `src/test/java/tw/lawgraph/mcp/LegalMcpIT.java`

**Interfaces:**
- Produces: sidecar 於 `http://legal-mcp:8000/mcp` 提供 Streamable HTTP MCP；compose 服務名 `app`、`legal-mcp`、`cloudflared`；環境變數 `OPENAI_API_KEY`、`CF_TUNNEL_TOKEN`、`LEGAL_MCP_URL`、`LAWGRAPH_SKILLS_DIR`。

- [ ] **Step 1: sidecar Dockerfile**

`docker/legal-mcp/requirements.txt`：
```text
mcp>=1.29,<2
mcp-taiwan-legal-db==1.0.0
playwright>=1.40
```

`docker/legal-mcp/Dockerfile`：
```dockerfile
# 台灣法規判例 MCP（mcp-taiwan-legal-db）以 Streamable HTTP 對外服務；含 Playwright 供司法院 WAF fallback
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && playwright install --with-deps chromium \
 && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
# FastMCP 讀 FASTMCP_HOST / FASTMCP_PORT；預設路徑 /mcp
ENV FASTMCP_HOST=0.0.0.0 FASTMCP_PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD curl -sf -X POST http://localhost:8000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' || exit 1
CMD ["python", "-c", "from mcp_server.server import mcp; mcp.run(transport='streamable-http')"]
```

- [ ] **Step 2: app Dockerfile 與 compose**

`docker/app/Dockerfile`：
```dockerfile
# 多階段：Maven 建置 → 精簡 JRE 執行；技能目錄一併複製
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
COPY skills/law-powers/skills /app/skills
ENV LAWGRAPH_SKILLS_DIR=/app/skills
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

`docker-compose.yml`：
```yaml
services:
  app:
    build: { context: ., dockerfile: docker/app/Dockerfile }
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LEGAL_MCP_URL: http://legal-mcp:8000
      LAWGRAPH_SKILLS_DIR: /app/skills
    ports: ["8080:8080"]
    depends_on:
      legal-mcp: { condition: service_healthy }
  legal-mcp:
    build: docker/legal-mcp
    volumes: [legal-cache:/usr/local/lib/python3.12/site-packages/mcp_server/data]
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}
    depends_on: [app]
volumes:
  legal-cache:
```

`.env.example`：
```text
OPENAI_API_KEY=sk-...
CF_TUNNEL_TOKEN=eyJ...
```

- [ ] **Step 3: 寫 MCP 整合測試（Testcontainers 建 sidecar 映像；無 Docker 時跳過）**

```java
package tw.lawgraph.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tw.lawgraph.api.CitationVerifier;
import java.nio.file.Path;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** 真的把 sidecar 跑起來，確認 Spring AI MCP client 能連上、白名單工具可呼叫。 */
@Testcontainers
@SpringBootTest(properties = {"OPENAI_API_KEY=test-key"})
class LegalMcpIT {
    static { assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "需要 Docker"); }

    @Container
    static GenericContainer<?> legalMcp = new GenericContainer<>(
            new ImageFromDockerfile().withFileFromPath(".", Path.of("docker/legal-mcp")))
        .withExposedPorts(8000)
        .waitingFor(Wait.forListeningPort()).withStartupTimeout(Duration.ofMinutes(5));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.ai.mcp.client.streamable-http.connections.legal-mcp.url",
            () -> "http://" + legalMcp.getHost() + ":" + legalMcp.getMappedPort(8000));
    }

    @Autowired CitationVerifier verifier;

    @Test
    void verifiesCivilCodeArticle184() {
        var v = verifier.verify("民法第184條");
        assertTrue(v.exists(), "全國法規資料庫應能查到民法第184條；snippet=" + v.snippet());
        assertEquals("law.moj.gov.tw", v.source());
    }
}
```

- [ ] **Step 4: 執行**

Run: `docker compose build legal-mcp 2>&1 | Tee-Object -FilePath logs/task11-build-mcp.log`（首次約 3–5 分鐘，Chromium 下載）。
Run: `mvn -q verify -Dtest=LegalMcpIT -DfailIfNoTests=false 2>&1 | Tee-Object -FilePath logs/task11-it.log`
Expected: PASS。若 Spring 因 `OPENAI_API_KEY=test-key` 在啟動時打 OpenAI 失敗，改用 `embabel-agent-starter-byok` 的說明或於測試 properties 加 `embabel.models.default-llm=gpt-5.4-mini` 並確認 OpenAI client 為 lazy；把實際解法寫進 README。

- [ ] **Step 5: Commit** — `git add docker docker-compose.yml .env.example src/test/java/tw/lawgraph/mcp; git commit -m "feat(infra): legal-mcp sidecar、app Dockerfile、compose 與 MCP 整合測試"`

---

### Task 12: 前端基礎 — i18n、狀態機、caseClient

**Files:**
- Create: `src/main/resources/static/js/i18n.js`、`js/state.js`、`js/caseClient.js`、`frontend-tests/i18n.test.mjs`、`frontend-tests/state.test.mjs`、`frontend-tests/caseClient.test.mjs`、`package.json`

**Interfaces:**
- Produces（ES module，瀏覽器與 node 共用）：
  - `i18n.js`：`export const DICT = { en: {...}, 'zh-TW': {...} }`；`export function t(key, locale)`（缺 key 回 key）；`export function detectLocale(navigatorLanguage, stored)`（stored 優先；`zh*`→`zh-TW`；否則 `en`）。
  - `state.js`：`export const States = { INPUT, RUNNING, QUESTIONS, RESULT, FAILED }`；`export function reduce(state, event)`；事件：`{type:'START', caseId}`、`{type:'STATUS', status:CaseStatus}`、`{type:'RESET'}`。純函式。
  - `caseClient.js`：`export function createCaseClient(fetchImpl, base='')` 回 `{ start(text, locale), status(id), answer(id, answers), samples(locale), verify(ref), poll(id, onStatus, intervalMs=2000) }`；`poll` 回 `stop()`；`COMPLETED|FAILED` 自動停。

- [ ] **Step 1: package.json 與失敗測試**

`package.json`：
```json
{
  "name": "law-graph-webmcp-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test frontend-tests/",
    "e2e": "playwright test -c e2e/playwright.config.mjs",
    "eval": "node scripts/eval-samples.mjs"
  },
  "devDependencies": { "@playwright/test": "^1.62.0" }
}
```

`frontend-tests/i18n.test.mjs`：
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, detectLocale, DICT } from '../src/main/resources/static/js/i18n.js';

test('兩語字典鍵集合一致', () => {
  assert.deepEqual(Object.keys(DICT.en).sort(), Object.keys(DICT['zh-TW']).sort());
});
test('t 缺 key 回 key、依語系取字', () => {
  assert.equal(t('app.title', 'en'), 'Law Graph');
  assert.equal(t('app.title', 'zh-TW'), '法律關係圖');
  assert.equal(t('nope.key', 'en'), 'nope.key');
});
test('detectLocale：儲存值優先，其次 zh 前綴，否則 en', () => {
  assert.equal(detectLocale('zh-TW', 'en'), 'en');
  assert.equal(detectLocale('zh-Hant-TW', null), 'zh-TW');
  assert.equal(detectLocale('ja', null), 'en');
});
```

`frontend-tests/state.test.mjs`：
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { States, reduce } from '../src/main/resources/static/js/state.js';

const s0 = { view: States.INPUT, caseId: null, last: null };
test('START 進 RUNNING 並記 caseId', () => {
  const s = reduce(s0, { type: 'START', caseId: 'p1' });
  assert.equal(s.view, States.RUNNING); assert.equal(s.caseId, 'p1');
});
test('STATUS 依 status 切 view', () => {
  const run = reduce(s0, { type: 'START', caseId: 'p1' });
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'WAITING' } }).view, States.QUESTIONS);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'RUNNING' } }).view, States.RUNNING);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'COMPLETED' } }).view, States.RESULT);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'FAILED' } }).view, States.FAILED);
});
test('RESET 回初始', () => {
  assert.deepEqual(reduce({ view: States.RESULT, caseId: 'p1', last: {} }, { type: 'RESET' }), s0);
});
```

`frontend-tests/caseClient.test.mjs`：
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaseClient } from '../src/main/resources/static/js/caseClient.js';

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const hit = routes.shift();
    return { ok: hit.ok ?? true, status: hit.status ?? 200, json: async () => hit.body };
  };
  f.calls = calls; return f;
}

test('start 送 POST /api/cases 並回 JSON', async () => {
  const fetch = fakeFetch([{ status: 201, body: { caseId: 'p1', status: 'RUNNING' } }]);
  const c = createCaseClient(fetch);
  const r = await c.start('A hit B', 'zh-TW');
  assert.equal(r.caseId, 'p1');
  assert.equal(fetch.calls[0].url, '/api/cases');
  assert.deepEqual(JSON.parse(fetch.calls[0].body), { caseText: 'A hit B', locale: 'zh-TW' });
});
test('非 2xx 丟出含 status 的錯誤', async () => {
  const c = createCaseClient(fakeFetch([{ ok: false, status: 429, body: { error: 'RATE_LIMITED' } }]));
  await assert.rejects(c.start('x', 'en'), (e) => e.status === 429 && e.code === 'RATE_LIMITED');
});
test('poll 於 COMPLETED 自動停止', async () => {
  const fetch = fakeFetch([{ body: { status: 'RUNNING' } }, { body: { status: 'COMPLETED' } }, { body: { status: 'COMPLETED' } }]);
  const c = createCaseClient(fetch);
  const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s.status); if (s.status === 'COMPLETED') res(); }, 5); });
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(seen, ['RUNNING', 'COMPLETED']);
  assert.equal(fetch.calls.length, 2, 'COMPLETED 後不得再輪詢');
});
```

- [ ] **Step 2: 執行確認失敗** — `npm test` → 模組不存在。

- [ ] **Step 3: 實作**

`js/i18n.js`（字典鍵至少涵蓋下列，兩語齊備）：
```js
/** 中英字典；鍵集合必須一致（有測試守著）。 */
export const DICT = {
  en: {
    'app.title': 'Law Graph', 'app.subtitle': 'Taiwan legal relationship graph, built with your agent',
    'agent.available': 'Agent tools: ready', 'agent.unavailable': 'Agent tools: unavailable',
    'input.placeholder': 'Describe the dispute: who, what happened, when, what you want.',
    'input.samples': 'Or start from a sample case', 'input.submit': 'Analyse',
    'progress.BRAINSTORM': 'Brainstorming facts & issues', 'progress.QUESTIONS': 'Waiting for your answers',
    'progress.RESEARCH': 'Searching statutes & judgments', 'progress.ANALYSIS': 'Element-by-element analysis',
    'progress.GRAPH': 'Building the graph',
    'questions.title': 'A few facts only you know', 'questions.why': 'Why we ask', 'questions.submit': 'Continue',
    'result.tab.graph': 'Graph', 'result.tab.analysis': 'Analysis', 'result.tab.research': 'Research', 'result.tab.brainstorm': 'Brainstorm',
    'result.generatedIn': 'Generated in', 'result.notes': 'Verification notes', 'result.newCase': 'New case',
    'failed.title': 'Analysis failed', 'failed.retry': 'Try again', 'disclaimer': 'Analysis support only — not legal advice. Sample cases are fictional. Do not paste real personal data.',
    'inspector.title': 'Tool Inspector', 'inspector.run': 'Run'
  },
  'zh-TW': {
    'app.title': '法律關係圖', 'app.subtitle': '與你的 Agent 一起建構的台灣法律關係圖',
    'agent.available': 'Agent 工具：可用', 'agent.unavailable': 'Agent 工具：不可用',
    'input.placeholder': '描述爭議：當事人、發生了什麼、時間、你想達成什麼。',
    'input.samples': '或從示範案例開始', 'input.submit': '開始分析',
    'progress.BRAINSTORM': '整理事實與爭點', 'progress.QUESTIONS': '等待你的回答',
    'progress.RESEARCH': '檢索法條與判決', 'progress.ANALYSIS': '逐要件涵攝',
    'progress.GRAPH': '建立關係圖',
    'questions.title': '幾個只有你知道的事實', 'questions.why': '為何要問', 'questions.submit': '繼續',
    'result.tab.graph': '關係圖', 'result.tab.analysis': '分析', 'result.tab.research': '檢索', 'result.tab.brainstorm': '頭腦風暴',
    'result.generatedIn': '產生語系', 'result.notes': '驗證紀錄', 'result.newCase': '新案件',
    'failed.title': '分析失敗', 'failed.retry': '重試', 'disclaimer': '僅供分析輔助，非法律意見。示範案例皆為虛構。請勿貼入真實個資。',
    'inspector.title': '工具檢視器', 'inspector.run': '執行'
  }
};
/** 取字；缺 key 回 key 方便抓漏。 */
export function t(key, locale) { return (DICT[locale] && DICT[locale][key]) || DICT.en[key] || key; }
/** 決定語系：使用者選過的優先，其次瀏覽器 zh*，否則 en。 */
export function detectLocale(navigatorLanguage, stored) {
  if (stored === 'en' || stored === 'zh-TW') return stored;
  return String(navigatorLanguage || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}
```

`js/state.js`：
```js
/** 頁面狀態機：純函式，方便測試。 */
export const States = Object.freeze({ INPUT: 'INPUT', RUNNING: 'RUNNING', QUESTIONS: 'QUESTIONS', RESULT: 'RESULT', FAILED: 'FAILED' });
const VIEW_BY_STATUS = { RUNNING: States.RUNNING, WAITING: States.QUESTIONS, COMPLETED: States.RESULT, FAILED: States.FAILED };
export const initialState = Object.freeze({ view: States.INPUT, caseId: null, last: null });
/** 依事件產生新狀態。 */
export function reduce(state, event) {
  switch (event.type) {
    case 'START': return { view: States.RUNNING, caseId: event.caseId, last: null };
    case 'STATUS': return { ...state, view: VIEW_BY_STATUS[event.status.status] || state.view, last: event.status };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}
```

`js/caseClient.js`：
```js
/** REST 封裝；fetchImpl 可注入以便測試。 */
export function createCaseClient(fetchImpl = globalThis.fetch, base = '') {
  async function call(path, init) {
    const res = await fetchImpl(base + path, { headers: { 'Content-Type': 'application/json' }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(body.message || res.status); e.status = res.status; e.code = body.error; throw e; }
    return body;
  }
  return {
    start: (caseText, locale) => call('/api/cases', { method: 'POST', body: JSON.stringify({ caseText, locale }) }),
    status: (id) => call(`/api/cases/${encodeURIComponent(id)}`),
    answer: (id, answers) => call(`/api/cases/${encodeURIComponent(id)}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }),
    samples: (locale) => call(`/api/samples?locale=${encodeURIComponent(locale)}`),
    verify: (ref) => call(`/api/laws/verify?ref=${encodeURIComponent(ref)}`),
    /** 每 intervalMs 輪詢一次；COMPLETED/FAILED 自動停；回傳 stop()。 */
    poll(id, onStatus, intervalMs = 2000) {
      let stopped = false; let timer = null;
      const tick = async () => {
        if (stopped) return;
        try { const s = await call(`/api/cases/${encodeURIComponent(id)}`); onStatus(s);
          if (s.status === 'COMPLETED' || s.status === 'FAILED') { stopped = true; return; } }
        catch (e) { onStatus({ status: 'FAILED', error: { code: e.code || 'NETWORK', message: e.message } }); stopped = true; return; }
        timer = setTimeout(tick, intervalMs);
      };
      tick();
      return () => { stopped = true; clearTimeout(timer); };
    }
  };
}
```

- [ ] **Step 4: 測試通過** — `npm test` → 9 tests pass。

- [ ] **Step 5: Commit** — `git add package.json frontend-tests src/main/resources/static/js/{i18n,state,caseClient}.js; git commit -m "feat(web): i18n 字典、狀態機與 caseClient（node --test）"`

---

### Task 13: 頁殼、四個 view 與 app.js 接線

**Files:**
- Create: `src/main/resources/static/index.html`、`css/app.css`、`js/main.js`、`js/app.js`、`js/views/util.js`、`js/views/input.js`、`js/views/progress.js`、`js/views/questions.js`、`js/views/result.js`
- Test: `frontend-tests/views.test.mjs`（view 純渲染函式回傳 HTML 字串，可在 node 測）

**Interfaces:**
- Consumes: `t`、`detectLocale`、`DICT`（i18n.js）；`States`、`reduce`、`initialState`（state.js）；`createCaseClient`（caseClient.js）。
- Produces（每個 view 為 `render(model, locale) -> string` 純函式 ＋ `bind(root, handlers)` 綁事件）：
  - `views/util.js`：`esc(text)` HTML 轉義；`mount(el, html)` 以 `DOMParser` 解析後 `replaceChildren`（所有動態文字都先經 `esc`，模板本身是程式常數）。
  - `views/input.js`：`renderInput({ samples }, locale)`；`bindInput(root, { onSubmit(text), onSample(id) })`
  - `views/progress.js`：`STEPS`；`renderProgress({ step }, locale)`（五步，當前 `active`、之前 `done`）
  - `views/questions.js`：`renderQuestions({ questions }, locale)`；`bindQuestions(root, { onSubmit(answers) })`（answers 為 `[{questionId, answer}]`）
  - `views/result.js`：`renderResult({ status, activeTab }, locale)`（四分頁；Graph 分頁只留 `#network-canvas` 與面板骨架，Task 14 填圖）；`bindResult(root, { onTab(name), onNewCase() })`
  - `app.js`：`export function createApp({ root, client, storage, navigatorLanguage })` 回 `{ mount, dispatch, getState, getLocale, getSamples, setLocale, start, startSample, answer, reset, onChange }`；掛載時從 `sessionStorage.caseId` 續接輪詢。DOM id 固定：`#stage`、`#lang-select`、`#agent-badge`。
  - `main.js`：瀏覽器入口，`window.__lawGraphApp = app`。

- [ ] **Step 1: 寫失敗測試**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/main/resources/static/js/views/util.js';
import { renderInput } from '../src/main/resources/static/js/views/input.js';
import { renderProgress } from '../src/main/resources/static/js/views/progress.js';
import { renderQuestions } from '../src/main/resources/static/js/views/questions.js';
import { renderResult } from '../src/main/resources/static/js/views/result.js';

test('esc 轉義五個危險字元', () => {
  assert.equal(esc(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('input 列出示範案例卡片並含 data-sample-id', () => {
  const html = renderInput({ samples: [{ id: 'car-accident', title: 'Car', summary: 's' }] }, 'en');
  assert.match(html, /data-sample-id="car-accident"/);
  assert.match(html, /Analyse/);
});
test('progress 高亮當前步驟且之前步驟標 done', () => {
  const html = renderProgress({ step: 'RESEARCH' }, 'zh-TW');
  assert.match(html, /class="step done"[^>]*data-step="BRAINSTORM"/);
  assert.match(html, /class="step active"[^>]*data-step="RESEARCH"/);
  assert.match(html, /檢索法條與判決/);
});
test('questions 每題一個 textarea，name 為 questionId', () => {
  const html = renderQuestions({ questions: [{ id: 'q1', text: 'Dashcam?', why: 'causation' }] }, 'en');
  assert.match(html, /<textarea[^>]*name="q1"/);
  assert.match(html, /causation/);
});
test('result 含四個分頁與 network-canvas，模型文字經轉義', () => {
  const status = { locale: 'en', result: { brainstorm: { facts: ['<b>x</b>'], relations: [], issues: [], evidenceNeeds: [], questions: [] },
    research: { laws: [], judgments: [], notes: ['removed edge: a->b (x)'] }, analysis: { elements: [], strategy: '', evidenceGaps: [], disclaimer: '' }, graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status }, 'en');
  assert.match(html, /id="network-canvas"/);
  assert.match(html, /data-tab="analysis"/);
  assert.match(html, /removed edge: a-&gt;b \(x\)/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});
```

- [ ] **Step 2: 執行確認失敗** — `npm test`。

- [ ] **Step 3: 實作 view（render 不碰 DOM；所有動態文字經 esc）**

`js/views/util.js`：
```js
/** HTML 轉義：所有由後端／模型產生的文字都必須經過這裡。 */
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
/** 以 DOMParser 解析程式產生的模板字串後掛入容器（不執行 script）。 */
export function mount(el, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  el.replaceChildren(...doc.body.childNodes);
}
```

`js/views/input.js`：
```js
import { t } from '../i18n.js';
import { esc } from './util.js';
/** 案情輸入頁：文字框 + 示範案例卡。 */
export function renderInput({ samples = [] }, locale) {
  const cards = samples.map((s) => `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span></button>`).join('');
  return `<section class="input">
    <textarea id="case-text" rows="10" placeholder="${esc(t('input.placeholder', locale))}"></textarea>
    <button id="case-submit" class="primary">${esc(t('input.submit', locale))}</button>
    <h3>${esc(t('input.samples', locale))}</h3><div class="samples">${cards}</div>
    <p class="disclaimer">${esc(t('disclaimer', locale))}</p></section>`;
}
/** 綁定送出與示範案例點選。 */
export function bindInput(root, { onSubmit, onSample }) {
  root.querySelector('#case-submit').addEventListener('click', () => onSubmit(root.querySelector('#case-text').value));
  root.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => onSample(b.dataset.sampleId)));
}
```

`js/views/progress.js`：
```js
import { t } from '../i18n.js';
import { esc } from './util.js';
export const STEPS = ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'GRAPH'];
/** 五步進度列。 */
export function renderProgress({ step }, locale) {
  const idx = STEPS.indexOf(step);
  return `<ol class="progress">${STEPS.map((s, i) => `<li class="step ${i < idx ? 'done' : i === idx ? 'active' : ''}" data-step="${s}">${esc(t('progress.' + s, locale))}</li>`).join('')}</ol>`;
}
```

`js/views/questions.js`：
```js
import { t } from '../i18n.js';
import { esc } from './util.js';
/** WaitFor 表單：每題 textarea＋「為何要問」。 */
export function renderQuestions({ questions = [] }, locale) {
  const items = questions.map((q) => `<label class="q"><span class="q-text">${esc(q.text)}</span>
    <small>${esc(t('questions.why', locale))}: ${esc(q.why)}</small><textarea name="${esc(q.id)}" rows="2"></textarea></label>`).join('');
  return `<form id="questions-form" class="questions"><h2>${esc(t('questions.title', locale))}</h2>${items}
    <button type="submit" class="primary">${esc(t('questions.submit', locale))}</button></form>`;
}
/** 送出時收集 [{questionId, answer}]。 */
export function bindQuestions(root, { onSubmit }) {
  root.querySelector('#questions-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = [...e.currentTarget.querySelectorAll('textarea')].map((ta) => ({ questionId: ta.name, answer: ta.value }));
    onSubmit(answers);
  });
}
```

`js/views/result.js`：
```js
import { t } from '../i18n.js';
import { esc } from './util.js';
const TABS = ['graph', 'analysis', 'research', 'brainstorm'];
/** 結果頁：Graph 分頁放渲染器骨架（Task 14 接圖），其餘分頁以清單呈現。 */
export function renderResult({ status, activeTab = 'graph' }, locale) {
  const r = status.result;
  const tabs = TABS.map((k) => `<button type="button" class="tab ${k === activeTab ? 'active' : ''}" data-tab="${k}">${esc(t('result.tab.' + k, locale))}</button>`).join('');
  const list = (arr, f = (x) => x) => `<ul>${(arr || []).map((x) => `<li>${esc(f(x))}</li>`).join('')}</ul>`;
  const metMark = (m) => (m === 'yes' ? '○' : m === 'no' ? '✗' : '△');
  const panels = {
    graph: `<div class="graph-wrap"><div class="graph-side"><div class="section-title">Filter</div><div id="filter-box"></div>
        <div class="section-title">Family</div><div id="family-box"></div><input id="search-input" type="text" placeholder="search"></div>
      <div id="network-canvas"></div>
      <aside class="detail-panel" id="detail-panel"><button class="close-btn" id="close-panel-btn" type="button">✕</button>
        <div class="detail-header"><span class="detail-tag" id="detail-tag"></span><h2 class="detail-title" id="detail-title"></h2></div>
        <div class="detail-body" id="detail-body"></div></aside></div>`,
    analysis: `<h3>Elements</h3>${list(r.analysis.elements, (e) => `${metMark(e.met)} ${e.law} — ${e.element}: ${e.basis}`)}
      <h3>Strategy</h3><p>${esc(r.analysis.strategy)}</p><h3>Evidence gaps</h3>${list(r.analysis.evidenceGaps)}<p class="disclaimer">${esc(r.analysis.disclaimer)}</p>`,
    research: `<h3>Statutes</h3>${list(r.research.laws, (l) => `${l.title}（${l.ref}）`)}<h3>Judgments</h3>${list(r.research.judgments, (j) => j.citation)}
      <h3>${esc(t('result.notes', locale))}</h3>${list(r.research.notes)}`,
    brainstorm: `<h3>Facts</h3>${list(r.brainstorm.facts)}<h3>Relations</h3>${list(r.brainstorm.relations)}<h3>Issues</h3>${list(r.brainstorm.issues)}<h3>Evidence needs</h3>${list(r.brainstorm.evidenceNeeds)}`
  };
  return `<section class="result"><nav class="tabs">${tabs}<span class="gen">${esc(t('result.generatedIn', locale))}: ${esc(status.locale)}</span>
    <button id="new-case" type="button">${esc(t('result.newCase', locale))}</button></nav>
    ${TABS.map((k) => `<div class="panel" data-panel="${k}" ${k === activeTab ? '' : 'hidden'}>${panels[k]}</div>`).join('')}</section>`;
}
/** 分頁切換與新案件。 */
export function bindResult(root, { onTab, onNewCase }) {
  root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => onTab(b.dataset.tab)));
  root.querySelector('#new-case').addEventListener('click', onNewCase);
}
```

- [ ] **Step 4: index.html、main.js、app.js、app.css**

`index.html`（`vendor/*.js` 於 Task 14 加入）：
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Law Graph</title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <header class="topbar">
    <div><h1 data-i18n="app.title">Law Graph</h1><p data-i18n="app.subtitle"></p></div>
    <div class="topbar-right">
      <span id="agent-badge" class="badge" data-i18n="agent.unavailable"></span>
      <select id="lang-select" aria-label="Language"><option value="en">English</option><option value="zh-TW">繁體中文</option></select>
    </div>
  </header>
  <main id="stage"></main>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

`js/main.js`：
```js
import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';
/** 瀏覽器入口：注入真實依賴並掛載；暴露到 window 供 webmcp.js／inspector.js／E2E 使用。 */
const app = createApp({ root: document, client: createCaseClient(fetch.bind(globalThis)), storage: window.sessionStorage, navigatorLanguage: navigator.language });
window.__lawGraphApp = app;
app.mount();
```

`js/app.js`：
```js
import { t, detectLocale, DICT } from './i18n.js';
import { States, reduce, initialState } from './state.js';
import { mount as mountHtml } from './views/util.js';
import { renderInput, bindInput } from './views/input.js';
import { renderProgress } from './views/progress.js';
import { renderQuestions, bindQuestions } from './views/questions.js';
import { renderResult, bindResult } from './views/result.js';

/** 應用程式核心：持有狀態、驅動輪詢、切換 view；WebMCP 由 webmcp.js 透過 onChange 掛上。 */
export function createApp({ root, client, storage, navigatorLanguage }) {
  let state = { ...initialState };
  let locale = detectLocale(navigatorLanguage, storage.getItem('locale'));
  let samples = [];
  let stopPolling = null;
  let activeTab = 'graph';
  const listeners = new Set();
  const stage = () => root.querySelector('#stage');

  function dispatch(event) { state = reduce(state, event); render(); listeners.forEach((l) => l(state, 'STATE')); }

  /** 依 view 渲染並綁事件。 */
  function render() {
    const el = stage(); if (!el) return;
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n, locale); });
    switch (state.view) {
      case States.INPUT: mountHtml(el, renderInput({ samples }, locale)); bindInput(el, { onSubmit: start, onSample: startSample }); break;
      case States.RUNNING: mountHtml(el, renderProgress({ step: state.last?.step || 'BRAINSTORM' }, locale)); break;
      case States.QUESTIONS: mountHtml(el, renderProgress({ step: 'QUESTIONS' }, locale) + renderQuestions({ questions: state.last.questions }, locale)); bindQuestions(el, { onSubmit: answer }); break;
      case States.RESULT: mountHtml(el, renderResult({ status: state.last, activeTab }, locale)); bindResult(el, { onTab: (k) => { activeTab = k; render(); }, onNewCase: reset }); listeners.forEach((l) => l(state, 'RESULT_RENDERED')); break;
      case States.FAILED: mountHtml(el, renderFailed(state.last?.error, locale)); el.querySelector('#retry').addEventListener('click', reset); break;
    }
  }
  function renderFailed(error, loc) {
    const code = String(error?.code || ''), msg = String(error?.message || ''), step = String(error?.step || '');
    return `<section class="failed"><h2>${t('failed.title', loc)}</h2><p>${esc(code)} @ ${esc(step)}</p><p>${esc(msg)}</p><button id="retry" type="button">${t('failed.retry', loc)}</button></section>`;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function beginPolling(caseId) {
    if (stopPolling) stopPolling();
    stopPolling = client.poll(caseId, (s) => dispatch({ type: 'STATUS', status: s }));
  }
  /** 啟動新案件；回傳 CaseStatus。 */
  async function start(text) {
    if (!text || !text.trim()) return null;
    const s = await client.start(text.trim(), locale);
    storage.setItem('caseId', s.caseId);
    dispatch({ type: 'START', caseId: s.caseId });
    beginPolling(s.caseId);
    return s;
  }
  async function startSample(id) { const smp = samples.find((x) => x.id === id); return smp ? start(smp.text) : null; }
  /** 送出回答並續接輪詢。 */
  async function answer(answers) { const s = await client.answer(state.caseId, answers); dispatch({ type: 'STATUS', status: s }); beginPolling(state.caseId); return s; }
  function reset() { if (stopPolling) stopPolling(); storage.removeItem('caseId'); activeTab = 'graph'; dispatch({ type: 'RESET' }); }
  async function setLocale(code) { locale = code in DICT ? code : 'en'; storage.setItem('locale', locale); samples = await client.samples(locale); render(); }

  /** 掛載：語系選單、載示範案例、續接進行中的 case。 */
  async function mount() {
    const sel = root.querySelector('#lang-select'); sel.value = locale; sel.addEventListener('change', () => setLocale(sel.value));
    samples = await client.samples(locale);
    const saved = storage.getItem('caseId');
    if (saved) { dispatch({ type: 'START', caseId: saved }); beginPolling(saved); } else render();
  }

  return { mount, dispatch, getState: () => state, getLocale: () => locale, getSamples: () => samples, setLocale, start, startSample, answer, reset,
    verify: (ref) => client.verify(ref), onChange: (l) => listeners.add(l) };
}
```

`css/app.css`：深色主題（底 `#0f172a`、字 `#e2e8f0`）；`.topbar` flex 兩端；`.progress` 五格橫列，`.done` 綠、`.active` 藍並 `animation: pulse 1.5s infinite`；`.samples` 2×2 grid；`.graph-wrap` 為 `display:grid; grid-template-columns:220px 1fr; height:70vh; position:relative`，`#network-canvas` 填滿；`.detail-panel` 絕對定位右側寬 360px、`transform:translateX(100%)`，`.active` 時 `translateX(0)`。把 law-powers `index.html` 第一個 `<style>` 區塊（4.8 KB：`.control-panel`、`.detail-panel`、`.legend-row`、`.section-title`、`.swatch` 等）貼入作為圖區基礎，再以上述規則覆寫尺寸。

- [ ] **Step 5: 測試通過並目視**

Run: `npm test` → 全綠（含 Task 12 的 9 個）。
Run: `npx serve src/main/resources/static -l 4173`，開 `http://localhost:4173`：INPUT 頁可見、語系切換會換文案（`/api/samples` 404 屬預期，卡片為空）。

- [ ] **Step 6: Commit** — `git add src/main/resources/static frontend-tests/views.test.mjs; git commit -m "feat(web): 頁殼、四個 view 與 app 狀態接線"`

---

### Task 14: 抽離 law-powers 3D 渲染器成 graphView.js

**Files:**
- Create: `scripts/extract-renderer.mjs`、`src/main/resources/static/vendor/three.min.js`、`vendor/three-spritetext.min.js`、`vendor/3d-force-graph.min.js`、`src/main/resources/static/js/graphView.js`
- Modify: `src/main/resources/static/index.html`（載入 vendor）、`js/app.js`（RESULT 渲染後呼叫 `graphView.render`）
- Test: `frontend-tests/graphView.test.mjs`（測純函式：`toGraphData`、`findNode`、`neighborsOf`）

**Interfaces:**
- Consumes: law-powers `index.html` 中含 `renderNetwork` 的應用層 `<script>`（約 25 KB，函式：`renderNetwork`、`toGraphData`、`nodeObject`、`linkStyle`、`linkColorFn`、`showDetail`、`hideDetail`、`buildFilters`、`buildFamilyFocus`、`applyFamilyFocus`、`bindSearch` 等）；DOM id：`network-canvas`、`detail-panel`、`detail-tag`、`detail-title`、`detail-body`、`close-panel-btn`、`filter-box`、`family-box`、`search-input`（Task 13 的 result.js 已提供）。
- Produces（ES module，全域 `THREE`、`SpriteText`、`ForceGraph3D` 由 vendor script 提供）：
  - `render(data)`：可重複呼叫；清空 `#network-canvas` 後重建；回傳 Graph 實例。
  - `focus(idOrLabel)`：鏡頭飛到節點並開詳情面板；回 `{ node, neighbors }` 或 `null`。
  - `filter({ groups, family, reset })`：套用群組可見度／家族聚焦；回 `{ visibleNodes, visibleEdges }`。
  - `explainEdge(sourceId, targetId)`：回 `{ label, rel, title, sourceLabel, targetLabel }` 或 `null`。
  - `summary()`：回 `{ nodeCounts, edgeCounts, topIssues, unmetElements }`。
  - 純函式（可在 node 測）：`toGraphData(data)`、`findNode(nodes, idOrLabel)`、`neighborsOf(links, nodeId)`。
  - `isWebglAvailable()`。

- [ ] **Step 1: 寫失敗測試（純函式）**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGraphData, findNode, neighborsOf, summarize } from '../src/main/resources/static/js/graphView.js';

const data = { nodes: [
  { id: 'f1', group: 'fact', label: 'Crash' }, { id: 'l1', group: 'law', label: 'Civil Code Art. 184 ¶1（民法第184條第1項）' },
  { id: 'i1', group: 'issue', label: 'Negligence' }, { id: 'e1', group: 'element', label: 'Causation', met: 'unknown' }],
  edges: [{ from: 'f1', to: 'l1', label: '適用' }, { from: 'ghost', to: 'l1', label: '引用' }, { from: 'l1', to: 'e1', label: '要件', title: 'decomposed' }] };

test('toGraphData 轉 from/to 為 source/target 並丟掉無效邊', () => {
  const g = toGraphData(data);
  assert.equal(g.links.length, 2);
  assert.deepEqual(g.links[0], { source: 'f1', target: 'l1', label: '適用', title: undefined, rel: undefined });
});
test('findNode 支援 id 與 label 子字串（含原文括號內）', () => {
  assert.equal(findNode(data.nodes, 'l1').id, 'l1');
  assert.equal(findNode(data.nodes, '民法第184條').id, 'l1');
  assert.equal(findNode(data.nodes, 'nothing'), null);
});
test('neighborsOf 回兩端相鄰節點 id', () => {
  const links = toGraphData(data).links;
  assert.deepEqual(neighborsOf(links, 'l1').sort(), ['e1', 'f1']);
});
test('summarize 統計群組、爭點與未該當要件', () => {
  const s = summarize(data);
  assert.equal(s.nodeCounts.law, 1); assert.equal(s.edgeCounts, 3);
  assert.deepEqual(s.topIssues, ['Negligence']); assert.deepEqual(s.unmetElements, ['Causation']);
});
```

- [ ] **Step 2: 執行確認失敗** — `npm test`。

- [ ] **Step 3: 抽離腳本（可重跑）**

`scripts/extract-renderer.mjs`：
```js
// 用途：從 law-powers 的單檔 index.html 抽出三個內嵌 lib 與應用層渲染腳本，
//       lib 寫到 static/vendor/，應用層寫到 scratch 檔供人工併入 graphView.js（不直接覆蓋）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = readFileSync(new URL('../skills/law-powers/index.html', import.meta.url), 'utf8');
const scripts = [...src.matchAll(/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g)].map((m) => m.groups.body);
const out = new URL('../src/main/resources/static/vendor/', import.meta.url); mkdirSync(out, { recursive: true });
const pick = (marker) => scripts.find((s) => s.includes(marker));
writeFileSync(new URL('three.min.js', out), pick('inlined: three.min.js'));
writeFileSync(new URL('three-spritetext.min.js', out), pick('inlined: three-spritetext.min.js'));
writeFileSync(new URL('3d-force-graph.min.js', out), pick('inlined: 3d-force-graph.min.js'));
writeFileSync(new URL('../js/_renderer-source.txt', out), pick('function renderNetwork'));
console.log('vendor libs written; application script saved to js/_renderer-source.txt for manual merge');
```
Run: `node scripts/extract-renderer.mjs`，確認 `vendor/` 三檔存在（約 608 KB／9 KB／622 KB）。`_renderer-source.txt` 加進 `.gitignore`。

- [ ] **Step 4: 實作 graphView.js**

以 `_renderer-source.txt` 為底改寫（保留 `COLORS`、`metColor`、`riskColor`、`judgmentColor`、`nodeObject`、`linkStyle`、`linkColorFn`、`showDetail`／`hideDetail` 與徽章函式、`buildFilters`、`buildFamilyFocus`、`applyFamilyFocus` 原邏輯），改動只有下列：

```js
/** law-powers 3D 渲染器的模組化包裝：可重複 render、可程式化 focus/filter，供 UI 與 WebMCP 共用。 */
let Graph = null;
let filterState = {};
let activeFamily = null;

/** superset JSON → 3d-force-graph {nodes, links}；edges.from/to → source/target，端點不存在的邊略過。 */
export function toGraphData(data) {
  const nodes = (data.nodes || []).map((n) => ({ ...n }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = (data.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, label: e.label, title: e.title, rel: e.rel }));
  return { nodes, links };
}
/** 以 id 精確或 label 子字串尋找節點。 */
export function findNode(nodes, idOrLabel) {
  return nodes.find((n) => n.id === idOrLabel) || nodes.find((n) => (n.label || '').includes(idOrLabel)) || null;
}
const endId = (x) => (typeof x === 'object' ? x.id : x);
/** 相鄰節點 id（不含自己）。 */
export function neighborsOf(links, nodeId) {
  const out = new Set();
  links.forEach((l) => { if (endId(l.source) === nodeId) out.add(endId(l.target)); if (endId(l.target) === nodeId) out.add(endId(l.source)); });
  return [...out];
}
/** 給 Agent 的摘要：群組計數、邊數、爭點、未該當／不明要件。 */
export function summarize(data) {
  const nodeCounts = {};
  (data.nodes || []).forEach((n) => { nodeCounts[n.group] = (nodeCounts[n.group] || 0) + 1; });
  return { nodeCounts, edgeCounts: (data.edges || []).length,
    topIssues: (data.nodes || []).filter((n) => n.group === 'issue').map((n) => n.label).slice(0, 10),
    unmetElements: (data.nodes || []).filter((n) => n.group === 'element' && n.met !== 'yes').map((n) => n.label) };
}
export function isWebglAvailable() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

let current = null;   // 最近一次 render 的原始資料
/** 渲染（可重複呼叫）。 */
export function render(data) {
  current = data;
  const el = document.getElementById('network-canvas');
  el.replaceChildren();
  if (!isWebglAvailable()) { showCanvasError('WebGL is not available in this browser', ['Open the page in Chrome/Edge/Firefox with hardware acceleration enabled.', 'Remote desktops and IDE preview browsers often disable WebGL.']); return null; }   // showCanvasError 沿用原函式
  Graph = ForceGraph3D()(el).backgroundColor('#0f172a').graphData(toGraphData(data))
    .nodeThreeObject(nodeObject).nodeThreeObjectExtend(false)
    .linkColor(linkColorFn).linkWidth((l) => linkStyle(l).width).linkCurvature((l) => linkStyle(l).curve)
    .linkDirectionalArrowLength((l) => linkStyle(l).arrow).linkDirectionalArrowRelPos(1).linkOpacity(0.6)
    .onEngineStop(() => Graph.zoomToFit(600, 60));
  Graph.d3Force('charge').strength(-90);
  Graph.d3Force('link').distance((l) => ({ '證據': 26, '當事人': 60, '包含': 45, '課予': 40, '負擔': 55, '得請求': 55, '要件': 40, '該當': 55 })[l.label] ?? 80);
  const syncSize = () => Graph.width(el.clientWidth).height(el.clientHeight); syncSize(); new ResizeObserver(syncSize).observe(el);
  Graph.onNodeClick((n) => showDetail(n));
  document.getElementById('close-panel-btn')?.addEventListener('click', hideDetail);
  buildFilters(Graph.graphData().nodes); buildFamilyFocus(Graph.graphData().nodes); bindSearch();
  return Graph;
}
/** 鏡頭飛到節點並開面板。 */
export function focus(idOrLabel) {
  if (!Graph) return null;
  const { nodes, links } = Graph.graphData();
  const hit = findNode(nodes, idOrLabel); if (!hit) return null;
  const dist = 60, x = hit.x || 0, y = hit.y || 0, z = hit.z || 0, r = Math.hypot(x, y, z) || 1;
  Graph.cameraPosition({ x: x * (1 + dist / r), y: y * (1 + dist / r), z: z * (1 + dist / r) }, hit, 1200);
  showDetail(hit);
  const strip = ({ x, y, z, vx, vy, vz, fx, fy, fz, __threeObj, ...rest }) => rest;
  return { node: strip(hit), neighbors: neighborsOf(links, hit.id).map((id) => strip(nodes.find((n) => n.id === id))) };
}
/** 群組可見度／家族聚焦。 */
export function filter({ groups, family, reset } = {}) {
  if (!Graph) return null;
  const nodes = Graph.graphData().nodes;
  if (reset) { Object.keys(filterState).forEach((g) => (filterState[g] = true)); activeFamily = null; }
  if (Array.isArray(groups)) { Object.keys(filterState).forEach((g) => (filterState[g] = groups.includes(g))); }
  if (family !== undefined) activeFamily = family;
  Graph.nodeVisibility(nodeVis).linkVisibility(linkVis); applyFamilyFocus();
  const visibleNodes = nodes.filter(nodeVis).length;
  const visibleEdges = Graph.graphData().links.filter(linkVis).length;
  return { visibleNodes, visibleEdges };
}
/** 解釋一條邊。 */
export function explainEdge(sourceId, targetId) {
  if (!Graph) return null;
  const l = Graph.graphData().links.find((k) => endId(k.source) === sourceId && endId(k.target) === targetId); if (!l) return null;
  return { label: l.label, rel: l.rel, title: l.title, sourceLabel: l.source.label, targetLabel: l.target.label };
}
export function summary() { return current ? summarize(current) : null; }
```

`buildFilters` 內原本直接改 `Graph.nodeVisibility` 的 checkbox handler 保留；`applyFamilyFocus` 保留；`bindSearch` 改為呼叫 `focus(kw)`。原本 `window.addEventListener('load', ...)` 自動渲染那段**刪除**。

- [ ] **Step 5: 接進 app 與 index.html**

`index.html` 在 `<script type="module" src="js/main.js">` 之前加：
```html
<script src="vendor/three.min.js"></script>
<script src="vendor/three-spritetext.min.js"></script>
<script src="vendor/3d-force-graph.min.js"></script>
```
`main.js` 加：
```js
import * as graphView from './graphView.js';
app.onChange((state, kind) => { if (kind === 'RESULT_RENDERED' && state.last?.result?.graph) graphView.render(state.last.result.graph); });
window.__graphView = graphView;
```
分頁切換回 Graph 時 `render()` 會再跑一次（result.js 的 onTab 重繪 → RESULT_RENDERED），可接受。

- [ ] **Step 6: 測試與目視**

Run: `npm test` → 全綠。
目視：暫時在瀏覧器 console 執行 `__graphView.render(<law-powers data.js 的 GRAPH_DATA>)`（把 `skills/law-powers/data.js` 內容貼進 console 取得 `window.GRAPH_DATA`），確認 3D 圖出現、點節點開面板、`__graphView.focus('110示著訴1')` 會飛鏡頭。

- [ ] **Step 7: Commit** — `git add scripts/extract-renderer.mjs src/main/resources/static frontend-tests/graphView.test.mjs .gitignore; git commit -m "feat(web): 抽離 law-powers 3D 渲染器為 graphView 模組"`

---

### Task 15: WebMCP 十工具與 Tool Inspector

**Files:**
- Create: `src/main/resources/static/js/webmcp.js`、`js/inspector.js`
- Modify: `js/main.js`（掛載）、`css/app.css`（inspector 樣式）
- Test: `frontend-tests/webmcp.test.mjs`

**Interfaces:**
- Consumes: `window.__lawGraphApp`（Task 13）、`graphView`（Task 14）、`createCaseClient().verify`。
- Produces：
  - `export const TOOL_DEFS`：十個工具定義（`name`、`description`、`inputSchema`、`annotations`、`phase: 'base' | 'completed'`），**不含 execute**，可在 node 驗證。
  - `export function truncate(obj, max = 1500)`：JSON 字串化超過 `max` 時回 `{ truncated: true, summary }`。
  - `export function createWebMcp({ app, graphView, modelContext })` 回 `{ registerBase(), registerCompleted(), unregisterAll(), tools() }`；`modelContext` 為 `document.modelContext`（可注入假物件測試）。
  - `export function mountInspector(root, webmcp)`：折疊面板，列出目前註冊工具、JSON 輸入框、執行按鈕、結果區。

- [ ] **Step 1: 寫失敗測試**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFS, truncate, createWebMcp } from '../src/main/resources/static/js/webmcp.js';

test('十個工具，名稱/描述長度符合 Chrome 安全預算', () => {
  assert.equal(TOOL_DEFS.length, 10);
  for (const t of TOOL_DEFS) {
    assert.ok(t.name.length <= 30, t.name);
    assert.ok(t.description.length <= 150, t.name);
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(['base', 'completed'].includes(t.phase));
  }
  assert.ok(!TOOL_DEFS.some((t) => /answer/i.test(t.name)), '不得有代答工具');
});
test('唯讀工具帶 readOnlyHint；getAnalysis 帶 untrustedContentHint', () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((t) => [t.name, t]));
  assert.equal(byName.getCaseStatus.annotations.readOnlyHint, true);
  assert.equal(byName.getAnalysis.annotations.untrustedContentHint, true);
  assert.equal(byName.startCase.annotations?.readOnlyHint, undefined);
});
test('truncate 超過 1500 字元回摘要', () => {
  const big = { text: 'x'.repeat(2000) };
  const r = truncate(big);
  assert.equal(r.truncated, true); assert.ok(JSON.stringify(r).length <= 1500);
  assert.deepEqual(truncate({ a: 1 }), { a: 1 });
});
test('registerBase 只註冊 base 階段工具，registerCompleted 再加圖工具，unregisterAll 全部 abort', () => {
  const registered = []; let aborted = 0;
  const fakeContext = { registerTool: async (tool, opts) => { registered.push(tool.name); opts.signal.addEventListener('abort', () => aborted++); } };
  const w = createWebMcp({ app: {}, graphView: {}, modelContext: fakeContext });
  return w.registerBase().then(() => {
    assert.deepEqual(registered.sort(), ['getCaseStatus', 'listSampleCases', 'resetCase', 'startCase', 'verifyCitation']);
    return w.registerCompleted();
  }).then(() => { assert.equal(registered.length, 10); w.unregisterAll(); assert.equal(aborted, 10); });
});
```

- [ ] **Step 2: 執行確認失敗** — `npm test`。

- [ ] **Step 3: 實作 webmcp.js**

```js
/** WebMCP 工具層：只用 Imperative registerTool；圖操作工具於 COMPLETED 後才註冊；沒有代答工具。 */
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
const LOCALE = { type: 'string', enum: ['en', 'zh-TW'], description: 'Output language' };

export const TOOL_DEFS = [
  { name: 'listSampleCases', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List the built-in fictional sample disputes that can be analysed with startCase.',
    inputSchema: S({ locale: LOCALE }) },
  { name: 'startCase', phase: 'base', annotations: {},
    description: 'Start analysing a Taiwan legal dispute from free text or a sample id. Returns caseId and status.',
    inputSchema: S({ caseText: { type: 'string', minLength: 20 }, sampleId: { type: 'string' }, locale: LOCALE }) },
  { name: 'getCaseStatus', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Poll the current case: RUNNING step, WAITING with questions the human must answer on the page, COMPLETED or FAILED.',
    inputSchema: S({}) },
  { name: 'verifyCitation', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Check whether a Taiwan statute article or judgment citation exists in official databases.',
    inputSchema: S({ ref: { type: 'string', description: 'e.g. 民法第184條 or 最高法院108年度台上字第2345號' } }, ['ref']) },
  { name: 'resetCase', phase: 'base', annotations: {},
    description: 'Discard the current case and return the page to the input screen.',
    inputSchema: S({}) },
  { name: 'getAnalysis', phase: 'completed', annotations: { readOnlyHint: true, untrustedContentHint: true },
    description: 'Return one section of the completed analysis: brainstorm, research or analysis. Long output is summarised.',
    inputSchema: S({ section: { type: 'string', enum: ['brainstorm', 'research', 'analysis'] } }, ['section']) },
  { name: 'getGraphSummary', phase: 'completed', annotations: { readOnlyHint: true },
    description: 'Counts by node group, edge count, main issues and elements not yet satisfied.',
    inputSchema: S({}) },
  { name: 'focusNode', phase: 'completed', annotations: {},
    description: 'Fly the 3D camera to a node (by id or label text), open its detail panel and return its neighbours.',
    inputSchema: S({ nodeId: { type: 'string' }, label: { type: 'string' } }) },
  { name: 'filterGraph', phase: 'completed', annotations: {},
    description: 'Show only some node groups (fact, law, judgment, issue, element, ...) or one case family; reset restores all.',
    inputSchema: S({ groups: { type: 'array', items: { type: 'string' } }, family: { type: 'string' }, reset: { type: 'boolean' } }) },
  { name: 'explainEdge', phase: 'completed', annotations: { readOnlyHint: true },
    description: 'Explain the relationship on the edge between two node ids (label, relation type, note).',
    inputSchema: S({ sourceId: { type: 'string' }, targetId: { type: 'string' } }, ['sourceId', 'targetId']) }
];

/** 回傳長度護欄：超過 max 字元改回摘要。 */
export function truncate(obj, max = 1500) {
  const s = JSON.stringify(obj);
  if (s.length <= max) return obj;
  return { truncated: true, summary: s.slice(0, max - 60) + '…', hint: 'Use a narrower section or focusNode for details.' };
}

/** 建立 WebMCP 控制器；modelContext 可注入以便測試。 */
export function createWebMcp({ app, graphView, modelContext }) {
  let controller = null;
  const registered = new Set();

  /** 各工具的 execute：只呼叫領域函式，不碰 DOM。 */
  const exec = {
    listSampleCases: async ({ locale }) => { if (locale && locale !== app.getLocale()) await app.setLocale(locale); return app.getSamples().map(({ id, title, summary }) => ({ id, title, summary })); },
    startCase: async ({ caseText, sampleId, locale }) => {
      if (app.getState().view !== 'INPUT') return { ok: false, error: 'A case is in progress. Call resetCase first.' };
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      const s = sampleId ? await app.startSample(sampleId) : await app.start(caseText);
      if (!s) return { ok: false, error: 'Unknown sampleId or empty caseText.' };
      return { ok: true, caseId: s.caseId, status: s.status, step: s.step };
    },
    getCaseStatus: async () => { const last = app.getState().last; if (!last) return { status: 'NONE', hint: 'No case yet. Call startCase.' };
      const { result, ...rest } = last; return truncate(result ? { ...rest, hasResult: true } : rest); },
    verifyCitation: async ({ ref }) => truncate(await app.verify(ref)),
    resetCase: async () => { app.reset(); return { ok: true }; },
    getAnalysis: async ({ section }) => truncate(app.getState().last?.result?.[section] ?? { error: 'not completed' }),
    getGraphSummary: async () => truncate(graphView.summary() ?? { error: 'graph not rendered' }),
    focusNode: async ({ nodeId, label }) => truncate(graphView.focus(nodeId || label) ?? { error: 'node not found' }),
    filterGraph: async (args) => graphView.filter(args) ?? { error: 'graph not rendered' },
    explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: 'edge not found' }
  };

  async function registerPhase(phase) {
    if (!modelContext?.registerTool) return;
    controller ??= new AbortController();
    for (const def of TOOL_DEFS.filter((d) => d.phase === phase && !registered.has(d.name))) {
      await modelContext.registerTool({ name: def.name, description: def.description, inputSchema: def.inputSchema,
        annotations: def.annotations, execute: (input) => exec[def.name](input || {}) }, { signal: controller.signal });
      registered.add(def.name);
    }
  }
  return {
    registerBase: () => registerPhase('base'),
    registerCompleted: () => registerPhase('completed'),
    /** 全部解除（同一 AbortController），之後可重新 registerBase。 */
    unregisterAll: () => { controller?.abort(); controller = null; registered.clear(); },
    tools: () => [...registered],
    execute: (name, input) => exec[name](input || {})
  };
}
```
`app.verify(ref)` 由 Task 13 的 `createApp` 回傳物件提供。

- [ ] **Step 4: 實作 inspector.js 與掛載**

`js/inspector.js`：
```js
import { TOOL_DEFS } from './webmcp.js';
import { esc, mount } from './views/util.js';
/** 折疊式 Tool Inspector：沒有 WebMCP 的瀏覽器也能手動執行十個工具看回傳。 */
export function mountInspector(root, webmcp, t, locale) {
  const host = document.createElement('aside'); host.id = 'inspector'; host.className = 'inspector collapsed'; root.body.appendChild(host);
  const draw = () => {
    const opts = TOOL_DEFS.map((d) => `<option value="${d.name}" ${webmcp.tools().includes(d.name) ? '' : 'disabled'}>${d.name}${webmcp.tools().includes(d.name) ? '' : ' (inactive)'}</option>`).join('');
    mount(host, `<button id="insp-toggle" type="button">${esc(t('inspector.title', locale))}</button>
      <div class="insp-body"><select id="insp-tool">${opts}</select><textarea id="insp-input" rows="3">{}</textarea>
      <button id="insp-run" type="button">${esc(t('inspector.run', locale))}</button><pre id="insp-out"></pre></div>`);
    host.querySelector('#insp-toggle').addEventListener('click', () => host.classList.toggle('collapsed'));
    host.querySelector('#insp-run').addEventListener('click', async () => {
      const name = host.querySelector('#insp-tool').value;
      let input = {}; try { input = JSON.parse(host.querySelector('#insp-input').value || '{}'); } catch (e) { host.querySelector('#insp-out').textContent = 'invalid JSON'; return; }
      try { host.querySelector('#insp-out').textContent = JSON.stringify(await webmcp.execute(name, input), null, 2); }
      catch (e) { host.querySelector('#insp-out').textContent = 'error: ' + e.message; }
    });
  };
  draw();
  return { refresh: draw };
}
```

`main.js` 追加：
```js
import { createWebMcp } from './webmcp.js';
import { mountInspector } from './inspector.js';
import { t } from './i18n.js';
const webmcp = createWebMcp({ app, graphView, modelContext: document.modelContext });
const badge = document.getElementById('agent-badge');
badge.dataset.i18n = document.modelContext?.registerTool ? 'agent.available' : 'agent.unavailable';
await webmcp.registerBase();
const inspector = mountInspector(document, webmcp, t, app.getLocale());
app.onChange(async (state, kind) => {
  if (kind === 'RESULT_RENDERED') { await webmcp.registerCompleted(); inspector.refresh(); }
  if (state.view === 'INPUT' && webmcp.tools().length > 5) { webmcp.unregisterAll(); await webmcp.registerBase(); inspector.refresh(); }
});
window.addEventListener('pagehide', () => webmcp.unregisterAll(), { once: true });
```
（`main.js` 為 module，可用頂層 await。）`inspector` 樣式：右下角固定、`.collapsed .insp-body{display:none}`。

- [ ] **Step 5: 測試通過** — `npm test` 全綠。

- [ ] **Step 6: Commit** — `git add src/main/resources/static frontend-tests/webmcp.test.mjs; git commit -m "feat(web): WebMCP 十工具（動態註冊、1.5K 護欄）與 Tool Inspector"`

---

### Task 16: E2E 旅程、eval 腳本、README 與上線

**Files:**
- Create: `e2e/playwright.config.mjs`、`e2e/journey.spec.mjs`、`scripts/eval-samples.mjs`、`README.md`
- Modify: `.gitignore`（`eval/`、`e2e/screenshots/` 已在）

**Interfaces:**
- Consumes: 全部前面任務；環境變數 `E2E_LIVE=1`（打真 LLM）、`BASE_URL`（預設 `http://localhost:8080`）。
- Produces: `npm run e2e`、`npm run eval`；README 含 Devpost 要求的全部段落。

- [ ] **Step 1: 啟動完整系統（本機）**

```powershell
Copy-Item .env.example .env   # 填入 OPENAI_API_KEY；CF_TUNNEL_TOKEN 先留空
docker compose up -d --build legal-mcp 2>&1 | Tee-Object -FilePath logs/task16-mcp.log
$env:OPENAI_API_KEY = (Get-Content .env | Select-String '^OPENAI_API_KEY=').ToString().Split('=')[1]
$env:LEGAL_MCP_URL = 'http://localhost:8000'
docker compose port legal-mcp 8000            # 若未對外映射，於 compose 的 legal-mcp 加 ports: ["8000:8000"]（僅開發用）
mvn -q spring-boot:run 2>&1 | Tee-Object -FilePath logs/task16-app.log
```
瀏覽 `http://localhost:8080`，用示範案例 `car-accident` 跑完整旅程一次，記錄總耗時與 `research.notes`。若 Embabel 找不到 `LegalGraphAgent`（`agents()` 為空），確認 `@Agent` 類在 `tw.lawgraph` 套件下且 `@EnableAgents` 存在。

- [ ] **Step 2: Playwright 設定與旅程測試**

`e2e/playwright.config.mjs`：
```js
import { defineConfig } from '@playwright/test';
/** E2E 設定：只有 E2E_LIVE=1 才會打真 LLM；截圖進 e2e/screenshots。 */
export default defineConfig({
  testDir: '.', timeout: 8 * 60_000, retries: 0,
  use: { baseURL: process.env.BASE_URL || 'http://localhost:8080', screenshot: 'only-on-failure', video: 'off' },
  outputDir: 'screenshots'
});
```

`e2e/journey.spec.mjs`：
```js
import { test, expect } from '@playwright/test';
// 用途：完整旅程——示範案例 → WAITING 作答 → COMPLETED → 圖有節點 → Inspector 執行 focusNode。
// 需要後端＋legal-mcp＋OPENAI_API_KEY；未設 E2E_LIVE=1 時整檔跳過。
test.skip(!process.env.E2E_LIVE, '需要 E2E_LIVE=1 與真 LLM');

test('car-accident sample completes with a graph and tools respond', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#lang-select', 'en');
  await page.click('[data-sample-id="car-accident"]');
  await expect(page.locator('.progress .step.active')).toBeVisible();
  // 等到 WAITING（示範案例刻意留白，必問）
  await page.waitForSelector('#questions-form', { timeout: 4 * 60_000 });
  const areas = page.locator('#questions-form textarea');
  const n = await areas.count();
  for (let i = 0; i < n; i++) await areas.nth(i).fill('Yes, there is dashcam footage showing the light was red.');
  await page.click('#questions-form button[type=submit]');
  await page.waitForSelector('#network-canvas canvas', { timeout: 6 * 60_000 });
  await page.screenshot({ path: 'e2e/screenshots/completed-graph.png', fullPage: true });
  const summary = await page.evaluate(() => window.__graphView.summary());
  expect(summary.nodeCounts.fact).toBeGreaterThan(0);
  expect(summary.nodeCounts.law).toBeGreaterThan(0);
  // Inspector：執行 getGraphSummary 與 focusNode
  await page.click('#insp-toggle');
  await page.selectOption('#insp-tool', 'getGraphSummary');
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('nodeCounts');
  await page.selectOption('#insp-tool', 'focusNode');
  await page.fill('#insp-input', JSON.stringify({ label: '民法' }));
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('neighbors');
  await expect(page.locator('#detail-panel')).toHaveClass(/active/);
});

test('research tab lists verification notes and page works without WebMCP', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#agent-badge')).toBeVisible();   // 徽章存在（Playwright Chromium 無 WebMCP → unavailable）
  await expect(page.locator('#inspector')).toBeVisible();
});
```

Run: `npx playwright install chromium`；`$env:E2E_LIVE='1'; npm run e2e 2>&1 | Tee-Object -FilePath logs/task16-e2e.log`
Expected: 2 passed；`e2e/screenshots/completed-graph.png` 產生。

- [ ] **Step 3: eval 腳本（四案 × 兩語，統計硬規則剔除數）**

`scripts/eval-samples.mjs`：
```js
// 用途：對四個示範案例各跑一次完整流程（兩語系），把 CaseStatus 存到 eval/，並統計硬規則剔除的節點／邊數。
// 需要後端運行中；WAITING 時以固定答案回覆。執行：node scripts/eval-samples.mjs [baseUrl]
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('eval', { recursive: true });
const canned = { en: 'Unknown / not available. Please assume the worst case for our side.', 'zh-TW': '不確定／無資料，請以對我方最不利的情況假設。' };
const rows = [];
for (const locale of ['en', 'zh-TW']) {
  const samples = await (await fetch(`${base}/api/samples?locale=${locale}`)).json();
  for (const s of samples) {
    const started = Date.now();
    let st = await (await fetch(`${base}/api/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseText: s.text, locale }) })).json();
    while (!['COMPLETED', 'FAILED'].includes(st.status)) {
      await sleep(3000);
      st = await (await fetch(`${base}/api/cases/${st.caseId}`)).json();
      if (st.status === 'WAITING') {
        const answers = st.questions.map((q) => ({ questionId: q.id, answer: canned[locale] }));
        st = await (await fetch(`${base}/api/cases/${st.caseId}/answers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) })).json();
      }
    }
    writeFileSync(`eval/${s.id}.${locale}.json`, JSON.stringify(st, null, 2));
    const notes = st.result?.research?.notes || [];
    rows.push({ sample: s.id, locale, status: st.status, seconds: Math.round((Date.now() - started) / 1000),
      nodes: st.result?.graph?.nodes?.length ?? 0, edges: st.result?.graph?.edges?.length ?? 0,
      removedNodes: notes.filter((n) => n.startsWith('removed unverified')).length,
      removedEdges: notes.filter((n) => n.startsWith('removed edge')).length });
  }
}
console.table(rows);
writeFileSync('eval/summary.json', JSON.stringify(rows, null, 2));
```
Run: `npm run eval 2>&1 | Tee-Object -FilePath logs/task16-eval.log`。判讀：任一案 `removedNodes` 佔原節點 > 30% 或 `nodes < 6` → 回 Task 5 微調對應 prompt（先改 research 的「ref 逐字複製」與 buildGraph 的規則段），改完重跑該案。

- [ ] **Step 4: README.md**

依 spec §9「參賽交付」逐段撰寫（中英各一段落式雙語或英文為主＋中文摘要皆可，預設英文）：
1. 一句話與截圖（`e2e/screenshots/completed-graph.png` 複製到 `docs/images/`）
2. **Why WebMCP**：頁面狀態（3D 圖、進行中的流程、已登入 session）只存在瀏覽器；Agent 用 `startCase`→`getCaseStatus`→`focusNode`，人負責回答提問——「人不可被繞過」的設計說明
3. **What humans and agents accomplish together**：五段流程圖 ＋ 影片腳本骨架（spec §5.1）
4. **Architecture**：spec §2 的 ASCII 圖；Embabel Skills 直接載入 law-powers、三條硬規則、只接 taiwan-legal-db
5. **WebMCP implementation**：貼 `TOOL_DEFS` 的 `startCase` 定義與 `registerTool` 片段；工具表（spec §5）；Chrome 149 flag 與 ChatGPT Site tools 兩種環境的支援差異（Declarative 不用）
6. **Run locally**：`.env`、`docker compose up -d --build`、`http://localhost:8080`；開發模式 `mvn spring-boot:run`
7. **Tests**：`mvn test`、`npm test`、`E2E_LIVE=1 npm run e2e`、`npm run eval`
8. **Limitations**：mini 模型品質、司法院 WAF、記憶體狀態、無上傳、dr-lawbot 未接
9. **Legal notice**：非法律意見；示範案例虛構；勿貼真實個資；law-powers 以 submodule 引用並保留其授權條款（含「經兆國際法律事務所」限制）；本 repo MIT
10. **Credits**：law-powers、Embabel、mcp-taiwan-legal-db、3d-force-graph

- [ ] **Step 5: Cloudflare Tunnel 上線**

```powershell
# 於 Cloudflare Zero Trust 建 tunnel，取得 token 填入 .env 的 CF_TUNNEL_TOKEN；Public hostname → http://app:8080
docker compose up -d --build 2>&1 | Tee-Object -FilePath logs/task16-compose.log
docker compose ps
curl.exe -sI https://<your-domain>/ | Select-Object -First 1     # 期待 HTTP/2 200
```
在 **Chrome 149+**（`chrome://flags/#enable-webmcp-testing` Enabled）開 `https://<your-domain>/`：DevTools console 執行 `await document.modelContext.getTools()` → 5 個 base 工具；跑完一案後再執行 → 10 個。
在 **ChatGPT 桌面版** 開同一網址：網址列 Site tools → Available site tools 應列出 5 個；口述案情讓 Agent 呼叫 `startCase`，看到 WAITING 後 Agent 轉述問題，在頁面作答，完成後請 Agent `focusNode`。全程錄影作為影片素材。

- [ ] **Step 6: 最終驗證與 commit**

```powershell
mvn -q verify 2>&1 | Tee-Object -FilePath logs/final-verify.log      # 含 LegalMcpIT（需 Docker）
npm test
git add -A
git commit -m "feat: E2E 旅程、eval 腳本、README 與部署設定"
```
確認 spec §9 驗收清單每一項可勾；未勾項目寫進 README 的 Limitations，不得無聲略過。

- [ ] **Step 7: 發佈與送件**

```powershell
gh repo create kevintsai1202/law-graph-webmcp --public --source . --push
gh repo edit kevintsai1202/law-graph-webmcp --description "WebMCP-enabled Taiwan legal relationship graph (law-powers × Embabel × gpt-5.4-mini)" --homepage https://<your-domain>/
```
GitHub About 需顯示 MIT（repo 根有 `LICENSE` 即會自動偵測）。Devpost 表單：Live URL、repo、< 3 分鐘 YouTube 連結、文字說明（直接取 README §2–§5）。截止：2026-09-03 13:00 PDT（台灣 9/4 04:00）。

---

## Spec 對照與偏差

| Spec 項目 | 對應任務 | 偏差 |
|---|---|---|
| §3 REST／CaseStatus／領域型別／硬規則／語系 | Task 2、3、8、9、10 | 無 |
| §4 Agent 五 Action、Skills、system prompt、MCP 白名單、錯誤處理 | Task 4–7、11 | `LlmOptions.maxTokens` 未在 1.5.1 文件確認，改以 Embabel `Budget`（預設 cost 2.0 USD／process）作成本護欄；`LEGAL_MCP_URL` 為基底 `http://legal-mcp:8000`（Spring AI streamable-http 以 `url` ＋ 預設 endpoint `/mcp` 連線），若連線失敗再加 `spring.ai.mcp.client.streamable-http.connections.legal-mcp.endpoint: /mcp` |
| §5 WebMCP 十工具、動態註冊、1.5K、無 answerQuestions | Task 15 | 無 |
| §6 前端佈局、狀態機、渲染器改造、i18n、示範案例 | Task 12–14、10 | `js/state.js` 從 `app.js` 拆出以便 node 測試 |
| §7 測試分層 | Task 2–15 各自測試、Task 11 IT、Task 16 E2E／eval | 無 |
| §8 容器與部署 | Task 11、16 | sidecar 以 `FASTMCP_HOST/PORT` 環境變數設定 host/port（FastMCP 1.x Settings），並鎖 `mcp<2` |
| §9 驗收清單、§10 時程 | Task 16 | 無 |

