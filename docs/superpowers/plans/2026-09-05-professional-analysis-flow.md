# 分析流程專業化（抗辯評估與舉證責任）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在涵攝之後新增「抗辯評估與舉證責任」步驤與結構化輸出，並把七步進度條與結果頁改成訴訟實務用語。

**Architecture:** Task 0 先在既有 LLM 轉送端點累計 usage 以量測 prompt cache 命中率；其後新增 domain record `CaseAssessment` 與 Embabel Action `assessCase`，靠 GOAP 型別鏈插在 `analyze` 與 `draftDocuments` 之間；`StatusSnapshot`／`CaseStatus.Result` 加欄位向後相容；前端 STEPS 加 `ASSESSMENT`，結果頁分析分頁新增兩張表與請求權小結。

**Tech Stack:** Java 21、Spring Boot 4.1、Embabel 1.5.1（`FakeOperationContext` 測試）、JUnit 5、前端 vanilla ES module + `node --test`、esbuild bundle。

**Spec:** `docs/superpowers/specs/2026-09-05-professional-analysis-flow-design.md`

## Global Constraints

- 所有 Maven 指令前綴 `export JAVA_HOME=/d/java/jdk-21`（Git Bash），否則會用 JDK 8 假失敗。
- 前端改動後必跑 `npm run bundle`，`app-bundle.js` 是提交的建置產物。
- i18n 中英鍵集合必須一致（`frontend-tests/i18n.test.mjs` 守著）。
- 程式碼註解用中文，函式級別註解必備。
- REST 契約只加欄位不改既有欄位；`@JsonInclude(NON_NULL)`。
- 本專案不是 git repo（根目錄無 .git），「Commit」步驟改為「確認測試綠燈並記錄到 logs/」。

---

### Task 0: LLM 呼叫 usage 量測（cached／reasoning tokens）

**Files:**
- Create: `src/main/java/tw/lawgraph/llm/LlmUsageStats.java`
- Modify: `src/main/java/tw/lawgraph/llm/LlmProxyController.java`（回應成功時解析 `usage` 並累計）
- Modify: `src/main/java/tw/lawgraph/usage/UsageController.java`（新增 `GET /api/usage/llm`）
- Test: `src/test/java/tw/lawgraph/llm/LlmUsageStatsTest.java`、`src/test/java/tw/lawgraph/llm/LlmProxyControllerTest.java`

**Interfaces:**
- Produces: `@Component LlmUsageStats` 含 `record(String responseBody)`、`snapshot()` → `LlmUsageStats.Snapshot(long calls, long promptTokens, long cachedTokens, long completionTokens, long reasoningTokens, double cacheHitRatio)`；`GET /api/usage/llm` 回該快照。

- [ ] **Step 1: 寫失敗測試（統計）**

```java
package tw.lawgraph.llm;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** 從 OpenAI 相容回應的 usage 累計 prompt／cached／completion／reasoning tokens，算出快取命中率。 */
class LlmUsageStatsTest {
    private static final String BODY = """
            {"id":"x","usage":{"prompt_tokens":1000,"completion_tokens":300,"total_tokens":1300,
             "completion_tokens_details":{"reasoning_tokens":250},"prompt_tokens_details":{"cached_tokens":400}}}
            """;

    @Test void accumulatesAndComputesRatio() {
        var stats = new LlmUsageStats();
        stats.record(BODY);
        stats.record(BODY.replace("\"cached_tokens\":400", "\"cached_tokens\":0"));
        var snap = stats.snapshot();
        assertEquals(2, snap.calls());
        assertEquals(2000, snap.promptTokens());
        assertEquals(400, snap.cachedTokens());
        assertEquals(600, snap.completionTokens());
        assertEquals(500, snap.reasoningTokens());
        assertEquals(0.2, snap.cacheHitRatio(), 1e-9);
    }

    @Test void ignoresBodiesWithoutUsage() {
        var stats = new LlmUsageStats();
        stats.record("{\"error\":\"x\"}");
        stats.record("not json");
        assertEquals(0, stats.snapshot().calls());
        assertEquals(0.0, stats.snapshot().cacheHitRatio(), 1e-9);
    }
}
```

- [ ] **Step 2: 跑測試確認失敗**（`cannot find symbol LlmUsageStats`）

Run: `export JAVA_HOME=/d/java/jdk-21; mvn -q -B test -Dtest=LlmUsageStatsTest -Dsurefire.failIfNoSpecifiedTests=false`

- [ ] **Step 3: 實作 LlmUsageStats**

```java
package tw.lawgraph.llm;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 累計經轉送端點的 LLM 呼叫 usage：prompt／cached／completion／reasoning tokens。
 * 目的：量測供應商端 prompt cache 命中率與 reasoning 佔比，決定要不要調整提示詞前綴。記憶體累計，重啟歸零。
 */
@Component
public class LlmUsageStats {
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    /** 統計快照；cacheHitRatio = cachedTokens / promptTokens（無呼叫時為 0）。 */
    public record Snapshot(long calls, long promptTokens, long cachedTokens, long completionTokens,
                           long reasoningTokens, double cacheHitRatio) {}

    private final AtomicLong calls = new AtomicLong();
    private final AtomicLong prompt = new AtomicLong();
    private final AtomicLong cached = new AtomicLong();
    private final AtomicLong completion = new AtomicLong();
    private final AtomicLong reasoning = new AtomicLong();

    /** 解析一筆回應 body 的 usage 並累計；沒有 usage 或不是 JSON 就略過。 */
    public void record(String responseBody) {
        if (responseBody == null) return;
        JsonNode usage;
        try {
            usage = MAPPER.readTree(responseBody).path("usage");
        } catch (RuntimeException parseFailure) {
            return;
        }
        if (usage.isMissingNode() || !usage.isObject()) return;
        calls.incrementAndGet();
        prompt.addAndGet(usage.path("prompt_tokens").asLong(0));
        completion.addAndGet(usage.path("completion_tokens").asLong(0));
        cached.addAndGet(usage.path("prompt_tokens_details").path("cached_tokens").asLong(0));
        reasoning.addAndGet(usage.path("completion_tokens_details").path("reasoning_tokens").asLong(0));
    }

    /** 目前累計值。 */
    public Snapshot snapshot() {
        long p = prompt.get();
        return new Snapshot(calls.get(), p, cached.get(), completion.get(), reasoning.get(), p == 0 ? 0.0 : (double) cached.get() / p);
    }
}
```

- [ ] **Step 4: 轉送端點接線**

`LlmProxyController` 建構子新增參數 `LlmUsageStats stats`（欄位 `private final LlmUsageStats stats;`），在 `http.send(...)` 之後、回傳之前加：
```java
        if (response.statusCode() < 400) stats.record(response.body());
```
並在每次成功呼叫用 INFO 記一行：`LOGGER.info("LLM usage prompt={} cached={} completion={} reasoning={}", ...)`——從 `stats` 新增一個 `static Snapshot parse(String body)` 也可以，但最簡單是在 `record` 回傳該筆的 Snapshot：把 `record` 改成 `public Snapshot record(String responseBody)` 回傳「這一筆」的值（沒有 usage 時回 `null`），Controller 用它寫 log。對應地，Step 1 測試不需改（回傳值可忽略）。

`LlmProxyControllerTest` 加 `@Import(LlmUsageStats.class)`（現有 `@Import(SecurityConfig.class)` 改成陣列）並新增測試：
```java
    /** 成功轉送後累計 usage；假上游回應加上 usage 欄位。 */
    @Test void recordsUsageFromUpstream() {
        // 先把 @BeforeAll 假上游的 reply 改成含 usage：
        // {"id":"chatcmpl-1","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"prompt_tokens_details":{"cached_tokens":4},"completion_tokens_details":{"reasoning_tokens":3}}}
        mvc.post().uri("/internal/llm/v1/chat/completions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"model\":\"m\",\"messages\":[]}").exchange();
        var snap = stats.snapshot();
        assertThat(snap.calls()).isGreaterThanOrEqualTo(1);
        assertThat(snap.cachedTokens()).isGreaterThanOrEqualTo(4);
    }
```
（`@Autowired LlmUsageStats stats;`）

- [ ] **Step 5: /api/usage/llm**

`UsageController` 建構子加 `LlmUsageStats llmStats`，新增：
```java
    /** GET /api/usage/llm：經轉送端點的 LLM 呼叫累計（prompt／cached／completion／reasoning 與快取命中率）。 */
    @GetMapping("/api/usage/llm")
    public LlmUsageStats.Snapshot llm() {
        return llmStats.snapshot();
    }
```
若有 `UsageController` 的 WebMvcTest，加 `@Import(LlmUsageStats.class)`。

- [ ] **Step 6: 全套測試、打包、本機量測**

Run: `mvn -B package`（JAVA_HOME）。本機以 Task 9 Step 1 的方式啟動（OPENAI_BASE_URL 指向 8090 的轉送端點），跑一案後 `curl -s http://localhost:8090/api/usage/llm`。
Expected: `calls` ≥ 8、`cacheHitRatio` 有值；把數字記進本計畫末段「執行紀錄」。若 `cacheHitRatio` < 0.2，在紀錄中註明「建議把技能內容移到提示詞最前面」作為後續工作，不在本計畫內改。

- [ ] **Step 7: 文件**

CLAUDE.md 在「LLM 轉送端點與思考強度」那行後補：`GET /api/usage/llm 揭露 cached／reasoning tokens 與命中率（記憶體累計，重啟歸零）。`

---

### Task 1: 領域模型 CaseAssessment

**Files:**
- Create: `src/main/java/tw/lawgraph/domain/Risk.java`
- Create: `src/main/java/tw/lawgraph/domain/DefenseAssessment.java`
- Create: `src/main/java/tw/lawgraph/domain/EvidenceItem.java`
- Create: `src/main/java/tw/lawgraph/domain/ChecklistItem.java`
- Create: `src/main/java/tw/lawgraph/domain/CaseAssessment.java`
- Test: `src/test/java/tw/lawgraph/domain/CaseAssessmentTest.java`

**Interfaces:**
- Produces: `CaseAssessment(List<DefenseAssessment> defenses, List<EvidenceItem> evidencePlan, List<ChecklistItem> checklist, String riskSummary)`；`ChecklistItem(String category, String item, String why, String dueHint)`；`DefenseAssessment(String issue, String defense, String response, Risk risk)`；`EvidenceItem(String fact, String burden, String available, String missing, String howToObtain)`；`enum Risk { high, medium, low }`。

- [ ] **Step 1: 寫失敗測試**

```java
package tw.lawgraph.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** CaseAssessment 對 null 欄位的兜底：清單變空、摘要變空字串，前端不會壞頁。 */
class CaseAssessmentTest {
    @Test void nullCollectionsBecomeEmpty() {
        var assessment = new CaseAssessment(null, null, null, null);
        assertEquals(List.of(), assessment.defenses());
        assertEquals(List.of(), assessment.evidencePlan());
        assertEquals(List.of(), assessment.checklist());
        assertEquals("", assessment.riskSummary());
    }

    @Test void keepsProvidedValues() {
        var defense = new DefenseAssessment("時效", "已罹於二年時效", "以知悉時點起算尚未屆滿", Risk.medium);
        var evidence = new EvidenceItem("知悉損害之時點", "被告", "無", "通知函送達證明", "向郵局申請掛號回執");
        var item = new ChecklistItem("證據文件", "通知函掛號回執", "證明知悉時點以對抗時效抗辯", "下次會面前");
        var assessment = new CaseAssessment(List.of(defense), List.of(evidence), List.of(item), "整體風險中等");
        assertEquals(1, assessment.defenses().size());
        assertEquals("證據文件", assessment.checklist().getFirst().category());
        assertEquals(Risk.medium, assessment.defenses().getFirst().risk());
        assertEquals("被告", assessment.evidencePlan().getFirst().burden());
    }
}
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `export JAVA_HOME=/d/java/jdk-21; mvn -q -B test -Dtest=CaseAssessmentTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: 編譯錯誤 `cannot find symbol CaseAssessment`

- [ ] **Step 3: 實作**

`Risk.java`
```java
package tw.lawgraph.domain;

/** 對造抗辯成立可能性的三級風險。 */
public enum Risk { high, medium, low }
```

`DefenseAssessment.java`
```java
package tw.lawgraph.domain;

/** 單一爭點上對造可能提出的抗辯、我方回應與風險評級。 */
public record DefenseAssessment(String issue, String defense, String response, Risk risk) {}
```

`EvidenceItem.java`
```java
package tw.lawgraph.domain;

/** 舉證責任與證據計畫一列：待證事實、依民訴 §277 由誰舉證、現有證據、缺口、取得方式。 */
public record EvidenceItem(String fact, String burden, String available, String missing, String howToObtain) {}
```

`ChecklistItem.java`
```java
package tw.lawgraph.domain;

/** 當事人準備清單一列：分類（證據文件／人證／程序事項／費用與期限／其他）、項目、為何需要、時限提示。 */
public record ChecklistItem(String category, String item, String why, String dueHint) {}
```

`CaseAssessment.java`
```java
package tw.lawgraph.domain;

import java.util.List;
import java.util.Objects;

/** assessCase Action 的產物：對造抗辯評估、舉證責任與證據計畫、當事人準備清單、風險摘要。null 一律兜底成空值。 */
public record CaseAssessment(List<DefenseAssessment> defenses, List<EvidenceItem> evidencePlan,
                             List<ChecklistItem> checklist, String riskSummary) {
    public CaseAssessment {
        defenses = defenses == null ? List.of() : List.copyOf(defenses.stream().filter(Objects::nonNull).toList());
        evidencePlan = evidencePlan == null ? List.of() : List.copyOf(evidencePlan.stream().filter(Objects::nonNull).toList());
        checklist = checklist == null ? List.of() : List.copyOf(checklist.stream().filter(Objects::nonNull).toList());
        riskSummary = riskSummary == null ? "" : riskSummary;
    }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: 同 Step 2。Expected: `Tests run: 2, Failures: 0`

---

### Task 2: 用語守門 TaiwanTerminology.sanitize(CaseAssessment)

**Files:**
- Modify: `src/main/java/tw/lawgraph/domain/TaiwanTerminology.java`（在 `sanitize(DraftedDocuments)` 之後新增 overload）
- Test: `src/test/java/tw/lawgraph/domain/TaiwanTerminologyTest.java`

**Interfaces:**
- Produces: `public static CaseAssessment sanitize(CaseAssessment assessment)`

- [ ] **Step 1: 寫失敗測試**（先看 `TaiwanTerminologyTest` 既有測試用哪個黑名單詞，沿用同一個；下例假設黑名單含「合同」→「契約」）

```java
    /** CaseAssessment 的抗辯、回應、證據欄位與風險摘要都要過用語守門。 */
    @Test void sanitizesCaseAssessmentStrings() {
        var raw = new CaseAssessment(
                List.of(new DefenseAssessment("合同效力", "合同無效", "合同有效", Risk.low)),
                List.of(new EvidenceItem("合同簽署", "原告", "合同影本", "", "調取原本")),
                List.of(new ChecklistItem("證據文件", "合同原本", "證明合同成立", "起訴前")),
                "合同風險低");
        var clean = TaiwanTerminology.sanitize(raw);
        assertEquals("契約效力", clean.defenses().getFirst().issue());
        assertEquals("契約無效", clean.defenses().getFirst().defense());
        assertEquals("契約影本", clean.evidencePlan().getFirst().available());
        assertEquals("契約原本", clean.checklist().getFirst().item());
        assertEquals("契約風險低", clean.riskSummary());
        assertEquals(Risk.low, clean.defenses().getFirst().risk());
    }
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `mvn -q -B test -Dtest=TaiwanTerminologyTest -Dsurefire.failIfNoSpecifiedTests=false`（記得 JAVA_HOME）
Expected: `cannot find symbol sanitize(CaseAssessment)`

- [ ] **Step 3: 實作 overload**（放在 `sanitize(DraftedDocuments)` 之後）

```java
    /** 對 CaseAssessment 的所有文字欄位套用同一套黑名單替換；風險等級與結構不變。 */
    public static CaseAssessment sanitize(CaseAssessment assessment) {
        if (assessment == null) return null;
        var defenses = assessment.defenses().stream()
                .map(d -> new DefenseAssessment(sanitize(d.issue()), sanitize(d.defense()), sanitize(d.response()), d.risk()))
                .toList();
        var evidence = assessment.evidencePlan().stream()
                .map(e -> new EvidenceItem(sanitize(e.fact()), sanitize(e.burden()), sanitize(e.available()),
                        sanitize(e.missing()), sanitize(e.howToObtain())))
                .toList();
        var checklist = assessment.checklist().stream()
                .map(c -> new ChecklistItem(sanitize(c.category()), sanitize(c.item()), sanitize(c.why()), sanitize(c.dueHint())))
                .toList();
        return new CaseAssessment(defenses, evidence, checklist, sanitize(assessment.riskSummary()));
    }
```

- [ ] **Step 4: 跑測試確認通過**

---

### Task 3: Prompt LegalPrompts.assess

**Files:**
- Modify: `src/main/java/tw/lawgraph/agent/LegalPrompts.java`（在 `analyze` 之後新增）
- Test: `src/test/java/tw/lawgraph/agent/LegalPromptsTest.java`

**Interfaces:**
- Produces: `public static String assess(CaseInput input, BrainstormResult brainstorm, ResearchResult research, AnalysisResult analysis, ClarifiedAnswers answers)`

- [ ] **Step 1: 寫失敗測試**

```java
    /** 抗辯評估 prompt 必須啟用涵攝技能、鎖定引用白名單、規定舉證責任字串並要求逐爭點列抗辯。 */
    @Test void assessPromptCoversDefensesBurdenAndAllowlist() {
        var research = new ResearchResult(List.of(), List.of(), List.of());
        var brainstorm = new BrainstormResult(List.of("f"), List.of(), List.of("時效是否完成"), List.of(), List.of());
        var analysis = new AnalysisResult(List.of(), "", List.of(), "");
        var answers = new ClarifiedAnswers(List.of(), List.of("無送達證明"));
        String prompt = LegalPrompts.assess(new CaseInput("A hit B", Locale.ZH_TW), brainstorm, research, analysis, answers);
        assertTrue(prompt.startsWith("Activate skill \"legal-element-analysis\""));
        assertTrue(prompt.contains("defenses"));
        assertTrue(prompt.contains("evidencePlan"));
        assertTrue(prompt.contains("checklist"));
        assertTrue(prompt.contains("證據文件|人證|程序事項|費用與期限|其他"));
        assertTrue(prompt.contains("民事訴訟法第277條"));
        assertTrue(prompt.contains("原告|被告|檢察官|不明"));
        assertTrue(prompt.contains("never search for new judgments"));
        assertTrue(prompt.contains("時效是否完成"));
        assertTrue(prompt.contains("無送達證明"));
        assertTrue(prompt.contains("Respond in zh-TW"));
    }
```

- [ ] **Step 2: 跑測試確認失敗**（`cannot find symbol assess`）

- [ ] **Step 3: 實作**

```java
    /** 建立抗辯評估與舉證責任 prompt：逐爭點列對造抗辯、我方回應與風險，逐待證事實定舉證責任與證據計畫。 */
    public static String assess(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                AnalysisResult analysis, ClarifiedAnswers answers) {
        return """
                Activate skill "legal-element-analysis" and extend its step 4 (結論與證據缺口). Output only the requested object.
                <case>%s</case>
                <brainstorm>%s</brainstorm>
                <research>%s</research>
                <analysis>%s</analysis>
                <answers>%s</answers>
                Produce:
                - defenses[]: for every issue in brainstorm.issues at least one row {issue, defense (what the opposing party will most likely argue, one sentence), response (our reply grounded in analysis.elements and the research allowlist, one or two sentences), risk (high|medium|low = likelihood the defense succeeds)}.
                - evidencePlan[]: one row per fact that decides an element with met=unknown or met=no, plus any fact the opposing party will contest: {fact (待證事實), burden (exactly one of 原告|被告|檢察官|不明, decided under 民事訴訟法第277條 or the criminal in dubio pro reo rule), available (evidence already in the case or answers; write 無 if none), missing (what is still needed), howToObtain (concrete Taiwan procedure: 聲請調查證據、函查、鑑定、證人、書證提出命令…)}.
                - checklist[]: a client preparation list the party can act on without a lawyer present: merge evidencePlan.missing, analysis.evidenceGaps and brainstorm.evidenceNeeds, deduplicate, then add procedural items (委任狀, 起訴或上訴期間, 裁判費概算, 管轄法院與當事人基本資料, 送達地址). Each row {category (exactly one of 證據文件|人證|程序事項|費用與期限|其他), item (what to prepare, concrete), why (one sentence linking it to an element, defense or procedural rule), dueHint (e.g. 下次會面前, 起訴前, 上訴期間內二十日, empty string if none)}.
                - riskSummary: three sentences at most: overall position, the single most dangerous defense, the single most important piece of evidence to secure.
                Rules: cite only research.laws[].ref, research.judgments[].citation and research.evidence — never search for new judgments; if coverage.semanticStatus is not SUCCESS, say so and lower certainty; Taiwan legal terms only (system rule 6); never invent facts, dates or amounts — use ○○ placeholders. Respond in %s.
                """.formatted(toJson(input), toJson(brainstorm), toJson(research), toJson(analysis), toJson(answers), input.locale().code());
    }
```

- [ ] **Step 4: 跑測試確認通過**

---


### Task 3b: 語氣分層 prompt 規則（白話詢問、專業輸出）

**Files:**
- Modify: `src/main/java/tw/lawgraph/agent/LegalPrompts.java`（`system()` 加規則；`brainstorm()`、`clarify()` 對 questions 加白話要求；`assess()` 對 checklist 加白話、其餘加專業要求）
- Test: `src/test/java/tw/lawgraph/agent/LegalPromptsTest.java`

**Interfaces:**
- Produces: `LegalPrompts.PLAIN_LANGUAGE_RULE`（package-private `static final String`），三個 prompt 皆包含其關鍵句。

- [ ] **Step 1: 寫失敗測試**

```java
    /** 對當事人的問題與清單要白話並附專業名詞；分析、抗辯回應與書狀維持專業用語。 */
    @Test void promptsSeparatePlainQuestionsFromProfessionalOutput() {
        var input = new CaseInput("A hit B", Locale.ZH_TW);
        var brainstorm = new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of());
        String system = LegalPrompts.system(Locale.ZH_TW);
        assertTrue(system.contains("plain language"));
        assertTrue(system.contains("professional term in parentheses"));
        String bs = LegalPrompts.brainstorm(input);
        assertTrue(bs.contains("questions[].text and why: plain language"));
        String clarify = LegalPrompts.clarify(input, brainstorm, List.of(), List.of(), 2);
        assertTrue(clarify.contains("plain language"));
        String assess = LegalPrompts.assess(input, brainstorm, new ResearchResult(List.of(), List.of(), List.of()),
                new AnalysisResult(List.of(), "", List.of(), ""), new ClarifiedAnswers(List.of(), List.of()));
        assertTrue(assess.contains("checklist rows: plain language"));
        assertTrue(assess.contains("defenses, evidencePlan and riskSummary: professional Taiwan legal register"));
    }
```

- [ ] **Step 2: `mvn -q -B test -Dtest=LegalPromptsTest -Dsurefire.failIfNoSpecifiedTests=false` 確認失敗**

- [ ] **Step 3: 實作**

在 `LegalPrompts` 類別頂端加常數：
```java
    /** 語氣分層：面向當事人的文字白話並附專業名詞；面向法院與法律人的輸出維持專業語體。 */
    static final String PLAIN_LANGUAGE_RULE = """
            Tone rule (two registers):
            - Anything addressed to the client — questions[].text and why, clarification questions, checklist rows — must be plain language a non-lawyer understands: short sentences, no 按／查／爰, and put the professional term in parentheses the first time a legal concept appears, e.g. 「對方可能主張你太晚提告（消滅時效抗辯）」.
            - Anything addressed to lawyers or the court — element basis and fact, strategy, defenses, responses, evidence plan, risk summary, every document — keeps the professional Taiwan legal register.
            """;
```
`system(locale)` 的規則清單末尾追加 `PLAIN_LANGUAGE_RULE`。
`brainstorm(input)` 在輸出欄位說明處加一句：`questions[].text and why: plain language, professional term in parentheses (see tone rule).`
`clarify(...)` 對 questions 加同一句：`questions: plain language, professional term in parentheses (see tone rule).`
`assess(...)` 的 Rules 加：`checklist rows: plain language for the client, professional term in parentheses; defenses, evidencePlan and riskSummary: professional Taiwan legal register.`

- [ ] **Step 4: 測試通過**（若既有測試斷言 prompt 以某字串結尾或精確相等，改成 `contains`）

### Task 4: Action assessCase 與 draftDocuments 接線

**Files:**
- Modify: `src/main/java/tw/lawgraph/agent/LegalGraphAgent.java`（`analyze` 之後新增 `assessCase`；`draftDocuments` 簽章加 `CaseAssessment assessment`）
- Modify: `src/main/java/tw/lawgraph/agent/LegalPrompts.java`（`draftDocuments` 加 `CaseAssessment` 參數與 `<assessment>` 區塊、一條規則）
- Test: `src/test/java/tw/lawgraph/agent/LegalGraphAgentTest.java`、`src/test/java/tw/lawgraph/agent/LegalPromptsTest.java`

**Interfaces:**
- Consumes: Task 1 `CaseAssessment`、Task 2 `TaiwanTerminology.sanitize(CaseAssessment)`、Task 3 `LegalPrompts.assess`
- Produces: `@Action public CaseAssessment assessCase(CaseInput, BrainstormResult, ResearchResult, AnalysisResult, ClarifiedAnswers, OperationContext)`；`draftDocuments(CaseInput, BrainstormResult, ResearchResult, AnalysisResult, CaseAssessment, OperationContext)`；`LegalPrompts.draftDocuments(CaseInput, BrainstormResult, ResearchResult, AnalysisResult, CaseAssessment)`

- [ ] **Step 1: 寫失敗測試（Agent）**

```java
    /** 抗辯評估 Action 走技能 prompt、輸出經用語守門；模型漏欄位時兜底為空清單。 */
    @Test
    void assessCaseUsesSkillPromptAndSanitizes() {
        var context = FakeOperationContext.create();
        var raw = new tw.lawgraph.domain.CaseAssessment(
                List.of(new tw.lawgraph.domain.DefenseAssessment("i", "合同無效", "合同有效", tw.lawgraph.domain.Risk.low)),
                null, null, null);
        context.expectResponse(raw);
        var answers = new ClarifiedAnswers(List.of(), List.of());
        var output = agent.assessCase(input, brainstorm, research, analysis, answers, context);
        assertEquals("契約無效", output.defenses().getFirst().defense());
        assertEquals(List.of(), output.evidencePlan());
        assertTrue(context.getLlmInvocations().getFirst().getPrompt().startsWith("Activate skill \"legal-element-analysis\""));
    }
```

並把既有呼叫 `agent.draftDocuments(input, brainstorm, research, analysis, context)` 的測試改成多傳一個 `new CaseAssessment(List.of(), List.of(), List.of(), "")`（用 grep `draftDocuments(` 找出所有呼叫點）。

- [ ] **Step 2: 寫失敗測試（Prompt）**

```java
    /** 書狀 prompt 帶入抗辯評估，要求答辯狀／準備書狀逐項回應對造抗辯。 */
    @Test void draftPromptIncludesAssessment() {
        var assessment = new CaseAssessment(
                List.of(new DefenseAssessment("時效", "已罹於時效", "尚未屆滿", Risk.high)), List.of(), List.of(), "");
        String prompt = LegalPrompts.draftDocuments(new CaseInput("A hit B", Locale.ZH_TW, List.of("answer"), ""),
                new BrainstormResult(List.of(), List.of(), List.of(), List.of(), List.of()),
                new ResearchResult(List.of(), List.of(), List.of()),
                new AnalysisResult(List.of(), "", List.of(), ""), assessment);
        assertTrue(prompt.contains("<assessment>"));
        assertTrue(prompt.contains("已罹於時效"));
        assertTrue(prompt.contains("assessment.defenses"));
    }
```

- [ ] **Step 3: 跑兩個測試類確認失敗**

Run: `mvn -q -B test -Dtest='LegalGraphAgentTest,LegalPromptsTest' -Dsurefire.failIfNoSpecifiedTests=false`

- [ ] **Step 4: 實作 Action**（放在 `analyze` 之後）

```java
    /** 步驟五之二：對造抗辯評估與舉證責任／證據計畫；只用已檢索法源，經台灣用語守門。 */
    @Action
    public CaseAssessment assessCase(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                     AnalysisResult analysis, ClarifiedAnswers answers, OperationContext context) {
        CaseAssessment assessment = llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.assess(input, brainstorm, research, analysis, answers), CaseAssessment.class);
        return TaiwanTerminology.sanitize(assessment == null ? new CaseAssessment(null, null, null, null) : assessment);
    }
```

`draftDocuments` 改為：
```java
    /** 步驟六：起草使用者勾選的書狀；帶入抗辯評估讓答辯／準備書狀能逐項回應。未勾選時不呼叫 LLM。 */
    @Action
    public DraftedDocuments draftDocuments(CaseInput input, BrainstormResult brainstorm, ResearchResult research,
                                           AnalysisResult analysis, CaseAssessment assessment, OperationContext context) {
        if (input.documents().isEmpty()) return new DraftedDocuments(List.of());
        DraftedDocuments drafted = llm(context)
                .withReference(skills)
                .withSystemPrompt(LegalPrompts.system(input.locale()))
                .createObject(LegalPrompts.draftDocuments(input, brainstorm, research, analysis, assessment), DraftedDocuments.class);
        return TaiwanTerminology.sanitize(drafted);
    }
```

補 import `tw.lawgraph.domain.CaseAssessment`。

- [ ] **Step 5: 實作 Prompt 變更**

`LegalPrompts.draftDocuments` 簽章加 `CaseAssessment assessment`；在 `<analysis>%s</analysis>` 之後加 `<assessment>%s</assessment>`，`formatted(...)` 多傳 `toJson(assessment)`；Rules 區塊加一行：

```
                - Use assessment.defenses: 答辯狀 and 準備書狀 must answer every listed defense in order; 起訴狀 pre-empts the defenses marked risk=high. Use assessment.evidencePlan to name the evidence offered or to be 聲請調查.
```

- [ ] **Step 6: 跑測試確認通過**，再跑全套 `mvn -B test 2>&1 | tee logs/test-assess-2026-09-05.log | grep -E "Tests run:.*Skipped: [0-9]+$|BUILD"`

---

### Task 5: 狀態契約 StatusSnapshot／CaseStatus.Result／StatusMapper

**Files:**
- Modify: `src/main/java/tw/lawgraph/api/StatusSnapshot.java`（`analysis` 之後加 `CaseAssessment assessment`）
- Modify: `src/main/java/tw/lawgraph/api/CaseStatus.java`（`Result` 加 `CaseAssessment assessment`，放在 `analysis` 之後）
- Modify: `src/main/java/tw/lawgraph/api/StatusMapper.java`（`deriveStep`、`partial`、COMPLETED 分支）
- Modify: `src/main/java/tw/lawgraph/api/CaseService.java`（`snapshot()` 讀 `blackboard.last(CaseAssessment.class)`）
- Test: `src/test/java/tw/lawgraph/api/StatusMapperTest.java`（更新 `snapshot(...)` 輔助與兩處直接建構；新增兩個測試）

**Interfaces:**
- Produces: `StatusSnapshot(caseId, locale, code, brainstorm, pendingQuestions, answers, research, analysis, assessment, documents, outcome, failure, failureCode)`；`CaseStatus.Result(brainstorm, research, analysis, assessment, documents, graph)`；步驤常數 `"ASSESSMENT"`。

- [ ] **Step 1: 寫失敗測試**

```java
    /** 涵攝完成、評估尚未產生 → 步驤 ASSESSMENT；評估完成、書狀未產生 → DOCUMENTS。 */
    @Test void assessmentStepDerivation() {
        var assessment = new CaseAssessment(List.of(), List.of(), List.of(), "低風險");
        var afterAnalysis = StatusMapper.map(snapshot(AgentProcessStatusCode.RUNNING, brainstorm, null,
                new UserAnswers(List.of()), research, analysis, null, null, null));
        assertEquals("ASSESSMENT", afterAnalysis.step());
        assertNull(afterAnalysis.result().assessment());
        var afterAssessment = StatusMapper.map(snapshot(AgentProcessStatusCode.RUNNING, brainstorm, null,
                new UserAnswers(List.of()), research, analysis, assessment, null, null));
        assertEquals("DOCUMENTS", afterAssessment.step());
        assertEquals("低風險", afterAssessment.result().assessment().riskSummary());
    }

    /** 完成時 result 帶 assessment。 */
    @Test void completedCarriesAssessment() {
        var assessment = new CaseAssessment(List.of(), List.of(), List.of(), "ok");
        var status = StatusMapper.map(snapshot(AgentProcessStatusCode.COMPLETED, brainstorm, null,
                new UserAnswers(List.of()), research, analysis, assessment, documents, graph));
        assertEquals("ok", status.result().assessment().riskSummary());
    }
```

同時把 `snapshot(...)` 輔助改為 9 個參數（在 `AnalysisResult a` 之後加 `CaseAssessment as`），既有呼叫在 `a` 後補 `null`；兩處 `new StatusSnapshot(...)` 直接建構在 `null, null, null, "boom", null` 的 analysis 位置之後補一個 `null`。

- [ ] **Step 2: 跑測試確認失敗**（建構子參數數量錯誤）

- [ ] **Step 3: 實作**

`StatusSnapshot`：
```java
public record StatusSnapshot(String caseId, Locale locale, AgentProcessStatusCode code,
                             BrainstormResult brainstorm, List<Question> pendingQuestions, UserAnswers answers,
                             ResearchResult research, AnalysisResult analysis, CaseAssessment assessment,
                             DraftedDocuments documents, GraphOutcome outcome, String failure, String failureCode) {}
```

`CaseStatus.Result`：
```java
    public record Result(BrainstormResult brainstorm, ResearchResult research,
                         AnalysisResult analysis, CaseAssessment assessment, List<DraftedDocument> documents, GraphData graph) {}
```

`StatusMapper`：
- COMPLETED 分支 `new CaseStatus.Result(snapshot.brainstorm(), research, snapshot.analysis(), snapshot.assessment(), documents(snapshot), snapshot.outcome().graph())`
- `partial`：條件加 `snapshot.assessment() == null`，建構加 `snapshot.assessment()`
- `deriveStep`：
```java
    static String deriveStep(StatusSnapshot snapshot) {
        if (snapshot.documents() != null) return "GRAPH";
        if (snapshot.assessment() != null) return "DOCUMENTS";
        if (snapshot.analysis() != null) return "ASSESSMENT";
        if (snapshot.research() != null) return "ANALYSIS";
        if (snapshot.answers() != null) return "RESEARCH";
        if (snapshot.brainstorm() != null) return "QUESTIONS";
        return "BRAINSTORM";
    }
```

`CaseService.snapshot()`：在 `blackboard.last(AnalysisResult.class)` 之後加 `blackboard.last(CaseAssessment.class)`，並 import。

- [ ] **Step 4: 跑 `StatusMapperTest`、`CaseServiceTest`、`CaseControllerTest`、`DailyCaseQuotaControllerTest` 確認通過**（後兩者建構 `CaseStatus` 時 `result` 傳 null，不受影響）。

---

### Task 6: 前端進度條七步與用語

**Files:**
- Modify: `src/main/resources/static/js/views/progress.js`（STEPS 加 `'ASSESSMENT'`）
- Modify: `src/main/resources/static/js/i18n.js`（progress.* 全部改字、新增 `progress.ASSESSMENT`、`result.tab.*` 改字）
- Test: `frontend-tests/views.test.mjs`

**Interfaces:**
- Produces: `STEPS.length === 7`，`STEPS[4] === 'ASSESSMENT'`。

- [ ] **Step 1: 寫失敗測試**

```js
test('進度條七步，第五步為抗辯評估與舉證責任，用語為訴訟實務用語', () => {
  assert.deepEqual(STEPS, ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'ASSESSMENT', 'DOCUMENTS', 'GRAPH']);
  const html = renderProgress({ step: 'ASSESSMENT' }, 'zh-TW');
  // 白話為主、括號附專業名詞
  assert.match(html, /對方會怎麼反駁、誰要負責證明（抗辯評估與舉證責任）/);
  assert.match(html, /逐條檢查是否符合法律要件（構成要件涵攝）/);
  assert.match(html, /找法條與判決（請求權基礎與實務見解檢索）/);
  assert.match(renderProgress({ step: 'ASSESSMENT' }, 'en'), /Defenses &amp; burden of proof/);
});
```
（`STEPS`、`renderProgress` 需自 `../src/main/resources/static/js/views/progress.js` import；若檔頭尚未 import 請補上。）

- [ ] **Step 2: 跑 `npm test` 確認失敗**

- [ ] **Step 3: 實作**

`progress.js`：
```js
/** 七個流程步驟（與後端 CaseStatus.step 同名）；未勾書狀時 DOCUMENTS 幾乎瞬間通過。 */
export const STEPS = ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'ASSESSMENT', 'DOCUMENTS', 'GRAPH'];
```

`i18n.js` en：
```js
    'progress.BRAINSTORM': 'Facts & issues', 'progress.QUESTIONS': 'Clarifying questions',
    'progress.RESEARCH': 'Legal basis & case-law research', 'progress.ANALYSIS': 'Element subsumption',
    'progress.ASSESSMENT': 'Defenses & burden of proof', 'progress.DOCUMENTS': 'Drafting documents',
    'progress.GRAPH': 'Relationship graph',
    'result.tab.graph': 'Graph', 'result.tab.analysis': 'Analysis', 'result.tab.research': 'Research', 'result.tab.brainstorm': 'Facts & issues',
```
zh-TW：
```js
    'progress.BRAINSTORM': '整理案情與爭執點（事實與爭點整理）', 'progress.QUESTIONS': '補充案情（等待你的回答）',
    'progress.RESEARCH': '找法條與判決（請求權基礎與實務見解檢索）', 'progress.ANALYSIS': '逐條檢查是否符合法律要件（構成要件涵攝）',
    'progress.ASSESSMENT': '對方會怎麼反駁、誰要負責證明（抗辯評估與舉證責任）', 'progress.DOCUMENTS': '撰寫法院文件（書狀起草）',
    'progress.GRAPH': '畫出法律關係圖',
    'result.tab.graph': '關係圖', 'result.tab.analysis': '法律分析（涵攝與評估）', 'result.tab.research': '法條與判決', 'result.tab.brainstorm': '案情與爭執點',
    'result.elements': '逐條檢查法律要件（構成要件涵攝表）',
```
其餘既有鍵不動；若既有測試比對舊字（grep `頭腦風暴`、`逐要件涵攝`、`檢索法條與判決`）一併更新期望值。

- [ ] **Step 4: `npm test` 通過**

---

### Task 7: 結果頁「涵攝與評估」分頁

**Files:**
- Modify: `src/main/resources/static/js/views/result.js`（`SECTION_HTML.analysis` 改吃 `{ analysis, assessment }`；新增 `claimSummary`、`defensesTable`、`evidenceTable`；`renderSections`／`renderResult` 傳入 `assessment`）
- Modify: `src/main/resources/static/js/i18n.js`（新增 result.defenses、result.evidencePlan、result.risk、result.claimSummary、claim.*、evidence.*、defense.*、risk.*）
- Modify: `src/main/resources/static/css/app.css`（`.assess-table`、`.risk-high/-medium/-low`、`.claim-summary`）
- Test: `frontend-tests/views.test.mjs`

**Interfaces:**
- Consumes: `status.result.assessment` = `{ defenses: [{issue, defense, response, risk}], evidencePlan: [{fact, burden, available, missing, howToObtain}], riskSummary }`
- Produces: `renderResult({ status, activeTab, outputs }, locale)` 在 analysis 分頁輸出四區塊；`claimStatus(elements)` 純函式（export）回 `{ law, status: 'established'|'failed'|'pending' }[]`。

- [ ] **Step 1: 寫失敗測試**

```js
test('涵攝與評估分頁：請求權小結、對造抗辯表、證據舉證表、風險摘要', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    brainstorm: { facts: [], relations: [], issues: [], evidenceNeeds: [] },
    research: { laws: [], judgments: [], notes: [] },
    analysis: { elements: [
      { law: '民法第184條第1項', element: '故意或過失', met: 'yes', basis: 'b', fact: 'f' },
      { law: '民法第184條第1項', element: '損害', met: 'unknown', basis: 'b', fact: 'f' },
      { law: '民法第197條第1項', element: '二年時效', met: 'no', basis: 'b', fact: 'f' }
    ], strategy: '先補證據', evidenceGaps: ['醫療單據'], disclaimer: '' },
    assessment: {
      defenses: [{ issue: '時效', defense: '已罹於時效', response: '自知悉起算未滿二年', risk: 'high' }],
      evidencePlan: [{ fact: '知悉時點', burden: '被告', available: '無', missing: '送達證明', howToObtain: '函查郵局' }],
      riskSummary: '整體中等風險'
    },
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, activeTab: 'analysis', outputs: ['graph'] }, 'zh-TW');
  assert.match(html, /各項請求能不能成立（請求權基礎小結）/);
  assert.match(html, /民法第184條第1項[^<]*<[^>]*>[^<]*待補證據/);
  assert.match(html, /民法第197條第1項[^<]*<[^>]*>[^<]*有要件不該當/);
  assert.match(html, /對方可能怎麼反駁、我們怎麼回應（抗辯評估）/);
  assert.match(html, /已罹於時效/);
  assert.match(html, /risk-high/);
  assert.match(html, /誰要證明什麼、還缺哪些證據（舉證責任與證據計畫）/);
  assert.match(html, /函查郵局/);
  assert.match(html, /整體風險[\s\S]*整體中等風險/);
});

test('claimStatus 依要件該當性彙整：全 yes 成立、有 no 不成立、其餘待補證據', () => {
  const rows = claimStatus([
    { law: 'A', met: 'yes' }, { law: 'A', met: 'yes' },
    { law: 'B', met: 'yes' }, { law: 'B', met: 'no' },
    { law: 'C', met: 'unknown' }
  ]);
  assert.deepEqual(rows, [{ law: 'A', status: 'established' }, { law: 'B', status: 'failed' }, { law: 'C', status: 'pending' }]);
});
```

- [ ] **Step 2: `npm test` 確認失敗**

- [ ] **Step 3: 實作 result.js**

在 `elementsList` 之後新增：
```js
/** 依 law 分組彙整請求權成立狀態：全部 yes → established；任一 no → failed；其餘 → pending。保留首次出現順序。 */
export function claimStatus(elements) {
  const byLaw = new Map();
  (elements || []).forEach((e) => { if (!byLaw.has(e.law)) byLaw.set(e.law, []); byLaw.get(e.law).push(e.met); });
  return [...byLaw.entries()].map(([law, mets]) => ({
    law, status: mets.some((m) => m === 'no') ? 'failed' : mets.every((m) => m === 'yes') ? 'established' : 'pending'
  }));
}

/** 請求權基礎小結清單。 */
function claimSummaryList(elements, locale) {
  const rows = claimStatus(elements).map((r) =>
    `<li class="claim claim-${r.status}"><span class="claim-law">${esc(r.law)}</span><span class="claim-status">${esc(t('claim.' + r.status, locale))}</span></li>`).join('');
  return rows ? `<ul class="claim-summary">${rows}</ul>` : '';
}

/** 對造抗辯表：爭點／抗辯／回應／風險徽章。 */
function defensesTable(defenses, locale) {
  if (!defenses?.length) return `<p class="empty">${esc(t('result.none', locale))}</p>`;
  const head = ['defense.issue', 'defense.defense', 'defense.response', 'defense.risk'].map((k) => `<th>${esc(t(k, locale))}</th>`).join('');
  const rows = defenses.map((d) => `<tr><td>${esc(d.issue)}</td><td>${esc(d.defense)}</td><td>${esc(d.response)}</td><td><span class="risk risk-${esc(d.risk || 'medium')}">${esc(t('risk.' + (d.risk || 'medium'), locale))}</span></td></tr>`).join('');
  return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 證據與舉證責任表：待證事實／舉證責任／現有證據／缺口／取得方式。 */
function evidenceTable(items, locale) {
  if (!items?.length) return `<p class="empty">${esc(t('result.none', locale))}</p>`;
  const head = ['evidence.fact', 'evidence.burden', 'evidence.available', 'evidence.missing', 'evidence.howToObtain'].map((k) => `<th>${esc(t(k, locale))}</th>`).join('');
  const rows = items.map((e) => `<tr><td>${esc(e.fact)}</td><td>${esc(e.burden)}</td><td>${esc(e.available)}</td><td>${esc(e.missing)}</td><td>${esc(e.howToObtain)}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
```

`SECTION_HTML.analysis` 改為接收 `(a, locale, assessment)`：
```js
  analysis: (a, locale, assessment = null) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.elements')}${elementsList(a.elements, locale)}
      ${h3('result.claimSummary')}${claimSummaryList(a.elements, locale)}
      ${h3('result.defenses')}${defensesTable(assessment?.defenses, locale)}
      ${h3('result.evidencePlan')}${evidenceTable(assessment?.evidencePlan, locale)}
      ${h3('result.strategy')}<p>${esc(a.strategy || '')}</p>
      ${assessment?.riskSummary ? `${h3('result.risk')}<p>${esc(assessment.riskSummary)}</p>` : ''}
      ${h3('result.evidenceGaps')}${list(a.evidenceGaps)}`;
  },
```
並在 `renderSections`（進行中）與 `renderResult`（完成）呼叫處把 `r.assessment` 傳入第三個參數：`SECTION_HTML.analysis(r.analysis || {}, locale, r.assessment)`。既有 analysis 段落中原本的 strategy／evidenceGaps 輸出若已存在，改成上面的單一版本，避免重複。

若 `result.none` 鍵不存在，新增：en `'result.none': 'None'`、zh `'result.none': '無'`。

- [ ] **Step 4: i18n 新增鍵**（兩語系都要）

```js
    // en
    'result.defenses': 'Likely defenses & responses', 'result.evidencePlan': 'Evidence & burden of proof',
    'result.risk': 'Risk summary', 'result.claimSummary': 'Claim summary', 'result.none': 'None',
    'claim.established': 'All elements met', 'claim.failed': 'An element fails', 'claim.pending': 'Evidence needed',
    'defense.issue': 'Issue', 'defense.defense': 'Defense', 'defense.response': 'Response', 'defense.risk': 'Risk',
    'evidence.fact': 'Fact to prove', 'evidence.burden': 'Burden', 'evidence.available': 'Available', 'evidence.missing': 'Missing', 'evidence.howToObtain': 'How to obtain',
    'risk.high': 'High', 'risk.medium': 'Medium', 'risk.low': 'Low',
    // zh-TW
    'result.defenses': '對方可能怎麼反駁、我們怎麼回應（抗辯評估）', 'result.evidencePlan': '誰要證明什麼、還缺哪些證據（舉證責任與證據計畫）',
    'result.risk': '整體風險', 'result.claimSummary': '各項請求能不能成立（請求權基礎小結）', 'result.none': '無',
    'claim.established': '要件齊備', 'claim.failed': '有要件不該當', 'claim.pending': '待補證據',
    'defense.issue': '爭點', 'defense.defense': '對造抗辯', 'defense.response': '我方回應', 'defense.risk': '風險',
    'evidence.fact': '待證事實', 'evidence.burden': '舉證責任', 'evidence.available': '現有證據', 'evidence.missing': '缺口', 'evidence.howToObtain': '取得方式',
    'risk.high': '高', 'risk.medium': '中', 'risk.low': '低',
```

- [ ] **Step 5: CSS**（加在 `.elements` 樣式之後）

```css
/* 涵攝與評估：請求權小結、抗辯表、證據表、風險徽章 */
.claim-summary { list-style: none; padding: 0; margin: 0 0 var(--space-4); display: grid; gap: var(--space-2); }
.claim { display: flex; justify-content: space-between; gap: var(--space-3); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
.claim-established { border-color: var(--color-ok); background: var(--color-ok-soft, #ecfdf5); }
.claim-failed { border-color: var(--color-bad); background: var(--color-bad-soft, #fef2f2); }
.claim-pending { border-color: var(--color-gold); background: var(--color-warn-soft, #fffbeb); }
.claim-status { font-weight: 600; white-space: nowrap; }
.table-wrap { overflow-x: auto; margin-bottom: var(--space-4); }
.assess-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.assess-table th, .assess-table td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--color-border); }
.assess-table th { color: var(--color-text-sub); font-weight: 600; white-space: nowrap; }
.risk { display: inline-block; padding: 2px 8px; border-radius: var(--radius-pill); font-size: 0.8rem; font-weight: 600; }
.risk-high { background: var(--color-bad-soft, #fef2f2); color: var(--color-bad); }
.risk-medium { background: var(--color-warn-soft, #fffbeb); color: #92400e; }
.risk-low { background: var(--color-ok-soft, #ecfdf5); color: var(--color-ok); }
```

- [ ] **Step 6: `npm test` 通過，`npm run bundle` 重建**

---


### Task 7b: 當事人準備清單分頁（獨立分頁、CSV 匯出、列印）

**Files:**
- Modify: `src/main/resources/static/js/views/result.js`（分頁清單加 `checklist`；新增 `checklistTable`、`checklistCsv`）
- Modify: `src/main/resources/static/js/app.js`（`bindResult` 內綁定 `#checklist-export` 與 `#checklist-print`；CSV 下載沿用爭點整理表的下載函式，grep `doc.issue.export` 找既有實作）
- Modify: `src/main/resources/static/js/i18n.js`、`src/main/resources/static/css/app.css`
- Test: `frontend-tests/views.test.mjs`

**Interfaces:**
- Consumes: `status.result.assessment.checklist` = `[{category, item, why, dueHint}]`
- Produces: 分頁 id `checklist`（排在書狀分頁之後、`AUX_TABS` 之前）；`export function checklistCsv(items, locale)` 回傳含 BOM 的 CSV 字串（欄：分類、項目、為何需要、時限）。

- [ ] **Step 1: 寫失敗測試**

```js
test('當事人準備清單分頁：依五類分組、匯出與列印按鈕；CSV 含標頭與 BOM', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    brainstorm: { facts: [], relations: [], issues: [], evidenceNeeds: [] },
    research: { laws: [], judgments: [], notes: [] },
    analysis: { elements: [], strategy: '', evidenceGaps: [], disclaimer: '' },
    assessment: { defenses: [], evidencePlan: [], riskSummary: '', checklist: [
      { category: '證據文件', item: '醫療費用單據正本', why: '證明損害額', dueHint: '起訴前' },
      { category: '程序事項', item: '委任狀', why: '委任律師訴訟代理', dueHint: '第一次開庭前' }
    ] },
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, activeTab: 'checklist', outputs: ['graph'] }, 'zh-TW');
  assert.match(html, /data-tab="checklist"/);
  assert.match(html, /你需要準備的東西/);
  assert.match(html, /<h3>證據文件<\/h3>[\s\S]*醫療費用單據正本/);
  assert.match(html, /<h3>程序事項<\/h3>[\s\S]*委任狀/);
  assert.match(html, /id="checklist-export"/);
  assert.match(html, /id="checklist-print"/);
  const csv = checklistCsv(status.result.assessment.checklist, 'zh-TW');
  assert.ok(csv.startsWith('\ufeff分類,項目,為何需要,時限'));
  assert.match(csv, /證據文件,醫療費用單據正本,證明損害額,起訴前/);
});

test('沒有清單資料時分頁不出現', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: { analysis: { elements: [] }, graph: { nodes: [], edges: [] } } };
  assert.doesNotMatch(renderResult({ status, activeTab: 'graph', outputs: ['graph'] }, 'zh-TW'), /data-tab="checklist"/);
});
```

- [ ] **Step 2: `npm test` 確認失敗**

- [ ] **Step 3: 實作 result.js**

分頁組成：在計算 `TABS` 的地方（`front` 之後、`AUX_TABS` 之前）加入 `...(status.result?.assessment?.checklist?.length ? ['checklist'] : [])`；`tabLabel('checklist')` 回 `t('result.tab.checklist', locale)`。

```js
/** 五個固定分類的顯示順序；模型給出其他字串時歸入「其他」。 */
const CHECKLIST_CATEGORIES = ['證據文件', '人證', '程序事項', '費用與期限', '其他'];

/** 當事人準備清單：依分類分組的表格，加匯出與列印按鈕。 */
function checklistTable(items, locale) {
  const groups = new Map(CHECKLIST_CATEGORIES.map((c) => [c, []]));
  (items || []).forEach((i) => groups.get(CHECKLIST_CATEGORIES.includes(i.category) ? i.category : '其他').push(i));
  const sections = [...groups.entries()].filter(([, rows]) => rows.length).map(([cat, rows]) => `<h3>${esc(cat)}</h3>
    <div class="table-wrap"><table class="assess-table checklist-table"><thead><tr><th>${esc(t('checklist.item', locale))}</th><th>${esc(t('checklist.why', locale))}</th><th>${esc(t('checklist.due', locale))}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.why)}</td><td>${esc(r.dueHint || '')}</td></tr>`).join('')}</tbody></table></div>`).join('');
  return `<section class="checklist" id="checklist-sheet"><p class="lead">${esc(t('checklist.lead', locale))}</p>${sections}
    <div class="actions"><button type="button" id="checklist-export" class="secondary">${esc(t('checklist.export', locale))}</button>
    <button type="button" id="checklist-print" class="secondary">${esc(t('checklist.print', locale))}</button></div></section>`;
}

/** 清單 CSV（含 BOM 讓 Excel 正確讀 UTF-8）：分類、項目、為何需要、時限；含雙引號、逗號或換行的欄位依 RFC 4180 轉義。 */
export function checklistCsv(items, locale) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = [t('checklist.category', locale), t('checklist.item', locale), t('checklist.why', locale), t('checklist.due', locale)].join(',');
  return '\ufeff' + [head, ...(items || []).map((i) => [i.category, i.item, i.why, i.dueHint].map(cell).join(','))].join('\n');
}
```

在 `panels` 物件加 `checklist: checklistTable(r.assessment?.checklist, locale)`。

- [ ] **Step 4: app.js 綁定**（在 `bindResult` 的分頁事件綁定附近）

```js
    // 當事人準備清單：CSV 下載與列印
    el.querySelector('#checklist-export')?.addEventListener('click', () => {
      const items = state.last?.result?.assessment?.checklist || [];
      downloadText(checklistCsv(items, locale), t('checklist.file', locale), 'text/csv;charset=utf-8');
    });
    el.querySelector('#checklist-print')?.addEventListener('click', () => globalThis.print?.());
```
`downloadText(text, filename, mime)` 若專案已有同功能函式（爭點整理表 CSV 匯出用），改呼叫既有函式並刪除此定義；否則新增：
```js
/** 以 Blob 觸發瀏覽器下載；測試環境無 document 或 createObjectURL 時安全略過。 */
function downloadText(text, filename, mime) {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}
```
並 import `checklistCsv`。

- [ ] **Step 5: i18n 與 CSS**

```js
    // en
    'result.tab.checklist': 'Client checklist', 'checklist.lead': 'Suggested items to prepare before the next meeting or filing.',
    'checklist.category': 'Category', 'checklist.item': 'Item', 'checklist.why': 'Why it matters', 'checklist.due': 'When',
    'checklist.export': 'Export CSV', 'checklist.print': 'Print', 'checklist.file': 'client-checklist.csv',
    // zh-TW
    'result.tab.checklist': '你需要準備的東西', 'checklist.lead': '下面是這個案子建議你先準備好的東西，最好在下次跟律師見面或送文件給法院之前備妥。',
    'checklist.category': '分類', 'checklist.item': '項目', 'checklist.why': '為何需要', 'checklist.due': '時限',
    'checklist.export': '匯出 CSV', 'checklist.print': '列印', 'checklist.file': '當事人準備清單.csv',
```
CSS：
```css
.checklist .lead { color: var(--color-text-sub); margin-bottom: var(--space-3); }
.checklist .actions { display: flex; gap: var(--space-2); margin-top: var(--space-3); }
@media print { body * { visibility: hidden; } #checklist-sheet, #checklist-sheet * { visibility: visible; } #checklist-sheet { position: absolute; left: 0; top: 0; width: 100%; } #checklist-sheet .actions { display: none; } }
```

- [ ] **Step 6: `npm test` 通過、`npm run bundle`**

### Task 8: WebMCP 工具描述與文件

**Files:**
- Modify: `src/main/resources/static/js/webmcp.js`（若工具描述或 `getCaseStatus` schema 列舉步驤名稱，加入 `ASSESSMENT`；grep `'GRAPH'` 與 `DOCUMENTS` 找位置；若無列舉則略過）
- Modify: `README.md`（流程說明改七步）、`CLAUDE.md`（新增一行記錄七步與 CaseAssessment）
- Test: `frontend-tests/webmcp.test.mjs`（若有步驤列舉測試則同步）

- [ ] **Step 1: grep**

Run: `grep -nE "ASSESSMENT|'DOCUMENTS'|\"DOCUMENTS\"" src/main/resources/static/js/webmcp.js frontend-tests/webmcp.test.mjs`
若有步驤列舉，在 `'ANALYSIS'` 後插入 `'ASSESSMENT'` 並更新對應測試期望。

- [ ] **Step 2: 文件**

CLAUDE.md 在「步驤看門狗」那行之前加：
```
- 流程七步（2026-09-05 起）：BRAINSTORM → QUESTIONS → RESEARCH → ANALYSIS → ASSESSMENT（assessCase：CaseAssessment{defenses, evidencePlan, riskSummary}，對造抗辯評估＋民訴 277 舉證責任）→ DOCUMENTS → GRAPH。StatusMapper.deriveStep 以 assessment 判斷 DOCUMENTS；CaseStatus.Result 多 assessment 欄位（NON_NULL）。結果頁「涵攝與評估」分頁含請求權小結（前端依 met 彙整）。
```
README 流程段落把六步改為七步並用新用語。

- [ ] **Step 3: `npm test`、`npm run bundle`、`mvn -B package` 全綠**

---

### Task 9: 本機實跑與線上部署驗證

**Files:**
- 無程式變更；使用 `scripts/compare-case-quality.mjs`

- [ ] **Step 1: 本機啟動**（需本機 legal-mcp：`docker compose run -d --name lawgraph-legal-mcp -p 8000:8000 legal-mcp`）

```bash
export JAVA_HOME=/d/java/jdk-21; set -a; . ./.env; set +a
LEGAL_MCP_URL=http://localhost:8000 LAWGRAPH_DAILY_TOKEN_LIMIT=0 LAWGRAPH_DAILY_CASES_PER_USER=0 \
OPENAI_BASE_URL=http://127.0.0.1:8090/internal/llm/v1 LAWGRAPH_LLM_UPSTREAM_BASE_URL=https://api.meta.ai/v1 LAWGRAPH_REASONING_EFFORT=low \
nohup "$JAVA_HOME/bin/java" -jar target/law-graph-webmcp-0.1.0-SNAPSHOT.jar --server.port=8090 > logs/app-local-assess.log 2>&1 &
```

- [ ] **Step 2: 跑一案並檢查 assessment**

Run: `node scripts/compare-case-quality.mjs assess http://localhost:8090 0`，然後
```bash
python -c "import json,io; d=json.load(io.open('eval/quality-assess.json',encoding='utf-8')); a=d['result']['assessment']; print(len(a['defenses']), len(a['evidencePlan']), len(a['checklist'])); print(a['riskSummary'])"
```
Expected: defenses ≥ 爭點數、evidencePlan ≥ 1、checklist ≥ 3 且含「程序事項」分類、riskSummary 非空；進度曾經過 `RUNNING:ASSESSMENT`（腳本 stepTimeline 有這個鍵）。

- [ ] **Step 3: 關閉本機、部署、驗證**

```bash
npx zeabur@latest deploy --project-id 6a94e7dc2ed2e7dbfbd22854 --service-id 6a94e90bb869c167a93d3b2e -i=false --json
# 等新版：外部 GET / 含 'ASSESSMENT'（app-bundle.js 內）；卡在 STARTING 超過 10 分鐘就 service restart
curl -s https://law-graph-webmcp.zeabur.app/js/app-bundle.js | grep -c ASSESSMENT
TEST_MODEL= node scripts/verify-semantic-live.mjs https://law-graph-webmcp.zeabur.app
```
Expected: PASS，且 `eval/` 產物含 assessment。

- [ ] **Step 4: 記錄**

把本機與線上耗時、defenses／evidencePlan 筆數寫進 `docs/superpowers/plans/2026-09-05-professional-analysis-flow.md` 末段「執行紀錄」。

---

## 自我檢查

- 規格覆蓋：G7（Task 3b 語氣分層、Task 6／7／7b 白話標籤）、G1（Task 1–4）、G2（Task 6）、G3（Task 7）、G4（Task 4 Step 5）、G5（Task 5 NON_NULL 加欄位）、G6（Task 1 ChecklistItem、Task 3 prompt checklist、Task 7b 分頁／CSV／列印）。
- 型別一致：`CaseAssessment(defenses, evidencePlan, checklist, riskSummary)` 於 Task 1、2、4、5、7、7b 一致；`deriveStep` 回傳 `"ASSESSMENT"` 與前端 `STEPS[4]` 一致；`LegalPrompts.draftDocuments` 五參數版本在 Task 4 定義並被 Agent 使用。
- 無佔位詞。
