# law-graph-webmcp 雙 MCP 法律研究聚合 TDD 開發計畫

日期：2026-09-03

狀態：Draft，需先確認規格未決策項目，再開始寫程式

規格：`docs/superpowers/specs/2026-09-03-dual-mcp-research-design.md`

> 本計畫以嚴格 Red → Green → Refactor 執行。每個 Task 先新增一個會因缺少行為而失敗的測試，確認失敗原因正確後，只實作讓該測試通過的最小程式，再跑相關回歸測試。

## 1. 實作前確認

開始 Task 1 前，由開發者確認以下理解：

1. `taiwan-legal-db` 負責法規與關鍵字判決；`tw-legal-rag` 只先承擔相關判決的語意軌。
2. AI 不直接合併 MCP raw response；Java 完成正規化、去重、排序、上限與降級後，才產生 `ResearchResult`。
3. 一般相關判決查詢必須雙軌排程；已知 JID／精確調卷可只走精確工具。
4. `analyze()` 預設不得重新搜尋新判決，避免繞過 merged research 白名單。
5. 語意 MCP 不可用時 keyword-only 續行；法規查無時不得由模型補法條。
6. 公開 Zeabur semantic 部署受 OAuth headless 行為與服務條款確認兩個閘門約束。

若以上任一點改變，先更新規格與本計畫，不直接在程式中隱含變更。

## 2. 全域限制

- 作業系統／指令：Windows PowerShell 7+。
- Java：21；執行 Maven 前確認 `JAVA_HOME=D:\java\jdk-21`。
- 現有工作樹有其他修改；每個 Task 只觸碰列出的檔案，commit 時只 stage 本計畫檔案。
- 新增與修改的 Java 函式需有中文函式級註解；重要欄位、executor、timeout 與白名單需有中文註解。
- unit test 不連外、不需要 OpenAI key、不需要 OAuth。
- live MCP／LLM 測試必須由明確環境變數啟用，預設 CI 跳過。
- 不關閉 TLS 驗證，不把 OAuth token 寫入 repo、test fixture、log 或測試報告。
- 不依賴 `List<McpSyncClient>` 順序；client selection 必須以具名設定或 server identity 驗證。
- 每個 Task 完成後執行 `git diff --check`，並檢查 `git diff --name-only` 未出現非預期檔案。

PowerShell 基線：

```powershell
$env:JAVA_HOME = 'D:\java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
mvn -q test
npm test
```

## 3. 測試分層

| 層 | 外部依賴 | 驗證重點 |
|---|---|---|
| Domain unit | 無 | canonical JID、trust gate、duplicate merge、穩定排序、coverage |
| Service unit | fake ports／受控 executor | 雙軌排程、timeout、fallback、結果收斂 |
| Adapter contract | JSON fixtures／mock client | MCP tool schema、參數映射、response parsing、錯誤分類 |
| Spring context | 本機 stub server | 兩個 connection、client identity、semantic unavailable 不拖垮 app |
| Agent contract | Embabel fake context | Action 型別鏈、prompt 白名單、analyze 不重新搜尋 |
| Integration | legal-mcp Testcontainer＋semantic stub | Streamable HTTP、完整 research chain、REST 相容 |
| Live gate | 真 OAuth／真 MCP／真 LLM | Zeabur 雙軌證據、去重、token 安全、實際結果品質 |

---

### Task 0：OAuth、工具 schema 與使用條款閘門

**Files:**

- Create after authenticated discovery: `src/test/resources/mcp/tw-legal-rag-tools-list.json`
- Create after sanitized response capture: `src/test/resources/mcp/tw-legal-rag-search-bundle.json`
- Create: `docs/test-evidence/dual-mcp/M0-contract-check.md`

**Purpose:**

先確認 production contract；本 Task 不修改應用程式。

- [ ] **Step 1：確認無敏感資料的端點狀態**

記錄 `https://tlr.dr-legal.com.tw/mcp` 未授權 initialize 回應狀態；artifact 只保留 HTTP status、content type 與錯誤分類，不保存 token、code、callback URL。

- [ ] **Step 2：以支援 OAuth 的互動式 MCP client 完成授權**

授權由使用者依 client UI 完成；Agent 不索取或輸出 token。

- [ ] **Step 3：取得並清理 `tools/list` fixture**

驗證 server identity、語意搜尋工具名稱、輸入 schema，以及 `doc_id`、引用白名單、全文欄位。fixture 不得包含 token、個資或真實案件全文。

- [ ] **Step 4：驗證 Spring AI 2.0.0 headless OAuth 可行性**

記錄 dynamic registration、authorization callback、refresh 與 container restart 行為。若無法在 Zeabur 安全完成，semantic deployment 保持 feature-disabled，但後續 domain／service 實作仍可用 fixture 完成。

- [ ] **Step 5：確認服務條款**

確認公開試驗網站不是被禁止的轉售或代管情境；結果寫入 M0 evidence。未確認不得部署 semantic production connection。

- [ ] **Step 6：Review gate**

開發者確認 fixture 與欄位映射後才開始 Task 1。

---

### Task 1：ResearchPlan、來源與 coverage 領域契約

**Files:**

- Create: `src/main/java/tw/lawgraph/research/ResearchPlan.java`
- Create: `src/main/java/tw/lawgraph/research/ResearchSource.java`
- Create: `src/main/java/tw/lawgraph/research/ResearchTrackStatus.java`
- Create: `src/main/java/tw/lawgraph/research/ResearchCoverage.java`
- Create: `src/main/java/tw/lawgraph/research/JudgmentCandidate.java`
- Create: `src/main/java/tw/lawgraph/research/JudgmentEvidence.java`
- Test: `src/test/java/tw/lawgraph/research/ResearchContractsTest.java`

**Interfaces:**

```text
ResearchPlan(regulationQueries, judgmentKeywordQueries, semanticCaseText)
JudgmentCandidate(rawId, canonicalJid, citation, court, date, summary, fullText,
                  url, sources, keywordRank, semanticScore, citationId,
                  citationAllowed, fullTextVerified)
JudgmentEvidence(judgment, sources, citationId, fullTextVerified)
ResearchCoverage(keywordStatus, semanticStatus, keywordCandidateCount,
                 semanticCandidateCount, mergedCount, droppedCount, truncatedCount)
```

- [ ] **RED：Step 1，寫空值與 immutable collection 測試**

測試 record constructor 將 null collection 正規化或拒絕、回傳集合不可被外部修改、空白 semantic query 不進 adapter。

Run：

```powershell
mvn -q '-Dtest=ResearchContractsTest' test
```

Expected：編譯失敗，因領域型別尚不存在。

- [ ] **GREEN：Step 2，建立最小 records／enums**

只加入測試要求的欄位與 validation；所有 public method／compact constructor 加中文註解。

- [ ] **REFACTOR：Step 3，收斂共用 normalization**

不在 record constructor 實作 JID 業務去重；只處理 null／blank 與 immutable copy，canonicalization 留到 Task 2。

- [ ] **Step 4，回歸**

```powershell
mvn -q '-Dtest=ResearchContractsTest,GraphRulesTest' test
git diff --check
```

---

### Task 2：JudgmentMergeService 確定性去重與排序

**Files:**

- Create: `src/main/java/tw/lawgraph/research/JudgmentIdNormalizer.java`
- Create: `src/main/java/tw/lawgraph/research/JudgmentMergeService.java`
- Test: `src/test/java/tw/lawgraph/research/JudgmentIdNormalizerTest.java`
- Test: `src/test/java/tw/lawgraph/research/JudgmentMergeServiceTest.java`

**Interfaces:**

```text
JudgmentIdNormalizer.canonicalize(rawId) -> String?
JudgmentMergeService.merge(keywordCandidates, semanticCandidates, maxResults)
    -> JudgmentMergeResult(evidence, warnings, coverage)
```

- [ ] **RED：Step 1，canonical JID 測試**

涵蓋 trim、Unicode NFKC、全半形、ASCII 大小寫、分隔符旁空白；確認中文字號不被破壞，raw ID 不被覆寫。

- [ ] **GREEN：Step 2，最小 normalizer**

不得用 citation 文本生成 JID；空白／無 ID 回 empty。

- [ ] **RED：Step 3，duplicate merge 測試**

至少包含：

- 相同 `doc_id/jid` 只輸出一筆。
- `sources` 聯集為 `KEYWORD + SEMANTIC`。
- 完整且 verified 的內容優先。
- 缺 JID 候選被丟棄並增加 dropped count。
- 欄位衝突產生 warning，不受輸入順序影響。

- [ ] **GREEN：Step 4，實作 merge**

先 group by canonical JID，再決定欄位；不要在迴圈中直接依到達順序覆蓋。

- [ ] **RED：Step 5，穩定排序／截斷測試**

輸入 permutation 後輸出 JSON 必須相同；排序依雙軌命中、全文驗證、semantic score、keyword rank、canonical JID。

- [ ] **GREEN：Step 6，實作 comparator 與 maxResults**

截斷後更新 coverage，不把被截斷候選放進 AI 白名單。

- [ ] **REFACTOR：Step 7，純函式檢查**

merger 不讀 clock、env、MCP client、LLM 或 static mutable state。

- [ ] **Step 8，回歸**

```powershell
mvn -q '-Dtest=JudgmentIdNormalizerTest,JudgmentMergeServiceTest' test
git diff --check
```

---

### Task 3：兩個 MCP port 與 response adapter

**Files:**

- Create: `src/main/java/tw/lawgraph/research/TaiwanLegalDbPort.java`
- Create: `src/main/java/tw/lawgraph/research/TwLegalRagPort.java`
- Create: `src/main/java/tw/lawgraph/research/mcp/McpTaiwanLegalDbAdapter.java`
- Create: `src/main/java/tw/lawgraph/research/mcp/McpTwLegalRagAdapter.java`
- Create: `src/main/java/tw/lawgraph/research/mcp/McpResearchException.java`
- Test: `src/test/java/tw/lawgraph/research/mcp/McpTaiwanLegalDbAdapterTest.java`
- Test: `src/test/java/tw/lawgraph/research/mcp/McpTwLegalRagAdapterTest.java`
- Fixtures: `src/test/resources/mcp/*.json`

**Interfaces:**

```text
TaiwanLegalDbPort.retrieve(plan) -> LegalDbResearch(laws, keywordCandidates)
TwLegalRagPort.retrieve(plan) -> SemanticResearch(semanticCandidates)
McpResearchException.kind -> AUTH | TIMEOUT | UPSTREAM | PARSE | INTERNAL
```

- [ ] **RED：Step 1，keyword request mapping 測試**

確認 keyword、case type、法院／日期與 maxResults 映射到 `search_judgments`；法規查詢只走 legal DB。

- [ ] **GREEN：Step 2，實作 legal DB adapter**

透過 `McpSyncClient.callTool()`；解析集中在 adapter，domain 不依賴 `McpSchema`。

- [ ] **RED：Step 3，semantic fixture parsing 測試**

依 M0 fixture 驗證 `doc_id`、score、allowed citation、摘要／全文欄位；缺欄位不得 NPE。

- [ ] **GREEN：Step 4，實作 semantic adapter**

工具名稱與 arguments 嚴格依 fixture，不自行猜測 production schema。

- [ ] **RED：Step 5，錯誤分類測試**

模擬 401、timeout、5xx、malformed payload；斷言只回錯誤種類與安全訊息，不含 response body／token。

- [ ] **GREEN：Step 6，最小 exception mapper**

- [ ] **REFACTOR：Step 7，共用 parsing helper 僅限無來源差異部分**

不要為消除少量重複而把兩個不同 MCP schema 混成難以維護的通用 JSON parser。

- [ ] **Step 8，回歸**

```powershell
mvn -q '-Dtest=McpTaiwanLegalDbAdapterTest,McpTwLegalRagAdapterTest' test
```

---

### Task 4：DualMcpResearchService 並行、timeout 與降級

**Files:**

- Create: `src/main/java/tw/lawgraph/research/DualMcpResearchService.java`
- Create: `src/main/java/tw/lawgraph/research/ResearchProperties.java`
- Create: `src/main/java/tw/lawgraph/research/ResearchOutcomeAssembler.java`
- Test: `src/test/java/tw/lawgraph/research/DualMcpResearchServiceTest.java`

**Interfaces:**

```text
DualMcpResearchService.research(ResearchPlan) -> ResearchResult
ResearchProperties(keywordTimeout, semanticTimeout, overallTimeout, maxJudgments)
```

- [ ] **RED：Step 1，雙軌皆被呼叫測試**

使用 fake ports＋`CyclicBarrier` 證明兩軌由不同 worker 排程；不以 `Thread.sleep()` 判定並行。

- [ ] **GREEN：Step 2，加入受控 executor**

使用明確命名、固定上限、可關閉的 executor bean；不得使用 common pool。legal DB 內部法規／keyword 操作可序列化，但 legal 與 semantic 兩軌並行。

- [ ] **RED：Step 3，semantic failure matrix**

分別測試 AUTH、TIMEOUT、UPSTREAM、PARSE；每種情況 keyword 結果都必須保留，coverage／notes 正確且只記一次降級訊息。

- [ ] **GREEN：Step 4，實作 graceful degradation**

- [ ] **RED：Step 5，keyword／兩軌 failure 測試**

確認法規失敗不產生 law；兩軌判決皆失敗時 judgments 空且 research incomplete；unexpected INTERNAL 可使 process 失敗。

- [ ] **GREEN：Step 6，完成 outcome assembler**

- [ ] **REFACTOR：Step 7，確保 deterministic output**

future 完成順序不得進入 merge comparator；timeout task 必須取消或安全收尾。

- [ ] **Step 8，回歸與資源釋放**

```powershell
mvn -q '-Dtest=DualMcpResearchServiceTest,JudgmentMergeServiceTest' test
```

確認測試結束後沒有殘留 non-daemon executor thread。

---

### Task 5：雙 connection、client registry 與 OAuth-safe startup

**Files:**

- Modify: `src/main/resources/application.yml`
- Modify: `src/main/java/tw/lawgraph/agent/config/ToolGroupsConfig.java`
- Create: `src/main/java/tw/lawgraph/research/mcp/McpClientRegistry.java`
- Create as M0 determines: `src/main/java/tw/lawgraph/research/mcp/TwLegalRagSecurityConfig.java`
- Modify: `src/test/resources/application-test.yml`
- Test: `src/test/java/tw/lawgraph/research/mcp/McpClientRegistryTest.java`
- Test: `src/test/java/tw/lawgraph/research/mcp/DualMcpContextTest.java`
- Modify: `src/test/java/tw/lawgraph/agent/config/ToolGroupsConfigTest.java`

- [ ] **RED：Step 1，client order independence 測試**

以反轉順序的兩個 fake／mock clients，確認 registry 仍依 server identity 取得正確 client；missing／duplicate identity 必須明確失敗或標記 unavailable。

- [ ] **GREEN：Step 2，實作 registry**

初始化後使用可驗證 server info；不得以 index 0／1 判斷來源。

- [ ] **RED：Step 3，設定契約測試**

驗證兩個 named connections；TW Legal RAG base URL 為 `https://tlr.dr-legal.com.tw`、endpoint 為 `/mcp`，不可形成 `/mcp/mcp`。

- [ ] **GREEN：Step 4，修改 application.yml**

加入 feature flag，例如 `lawgraph.research.semantic-enabled=false` 作安全預設；只有 M0 完成的環境才啟用。

- [ ] **RED：Step 5，semantic 401 不拖垮 app context 測試**

本機 stub semantic endpoint 回 401，legal DB stub 正常；斷言 Spring context 與 keyword port 可用，semantic status 為 unavailable。

- [ ] **GREEN：Step 6，依 M0 結果實作 OAuth／lazy initialization**

只採 Spring AI 2.0.0 實際可用 API；若需 security dependency，先寫 dependency presence test，再加入最小 dependency。token store／callback 必須可替換且不輸出敏感值。

- [ ] **REFACTOR：Step 7，ToolGroup 分離**

保留既有 legal whitelist；新增 semantic whitelist。若 Action 已改由 adapter 直接呼叫 MCP，semantic ToolGroup 不必暴露給 LLM，避免多餘工具面。

- [ ] **Step 8，回歸**

```powershell
mvn -q '-Dtest=McpClientRegistryTest,DualMcpContextTest,ToolGroupsConfigTest' test
```

---

### Task 6：Embabel Action 鏈與分析白名單

**Files:**

- Modify: `src/main/java/tw/lawgraph/agent/LegalGraphAgent.java`
- Modify: `src/main/java/tw/lawgraph/agent/LegalPrompts.java`
- Modify: `src/main/java/tw/lawgraph/domain/ResearchResult.java`
- Modify: `src/main/java/tw/lawgraph/domain/GraphRules.java`
- Modify: `src/test/java/tw/lawgraph/agent/LegalGraphAgentTest.java`
- Modify: `src/test/java/tw/lawgraph/agent/LegalPromptsTest.java`
- Modify: `src/test/java/tw/lawgraph/domain/GraphRulesTest.java`

**Target chain:**

```text
brainstorm → askUser → planResearch → research → analyze → draftDocuments → buildGraph
```

- [ ] **RED：Step 1，planResearch prompt 契約測試**

斷言 prompt 只產生 `ResearchPlan`，包含 case／brainstorm／answers，不聲稱已找到法源，也不掛 MCP ToolGroup。

- [ ] **GREEN：Step 2，新增 planResearch Action**

- [ ] **RED：Step 3，research 不呼叫 LLM 測試**

注入 fake `DualMcpResearchService`，斷言 `research()` 直接回 merged result，FakeOperationContext 沒有 LLM invocation。

- [ ] **GREEN：Step 4，替換舊 research tool loop**

- [ ] **RED：Step 5，analyze 只讀 merged evidence 測試**

斷言 analyze prompt 包含 sources／coverage，且 invocation 不含一般搜尋 ToolGroup；未出現在 merged research 的 JID 不得出現在 analysis fixture。

- [ ] **GREEN：Step 6，更新 analyze prompt／工具面**

- [ ] **RED：Step 7，GraphRules wrapper 相容測試**

確認 judgment node 由 `JudgmentEvidence.judgment.jid` 錨定；未合併 JID 仍被移除。

- [ ] **GREEN：Step 8，更新 ResearchResult／GraphRules**

- [ ] **REFACTOR：Step 9，移除舊降級硬編 prompt**

刪除「dr-lawbot NOT available」；改由 coverage 驅動語意可用性描述。保留防幻覺與雙語識別碼規則。

- [ ] **Step 10，回歸**

```powershell
mvn -q '-Dtest=LegalGraphAgentTest,LegalPromptsTest,GraphRulesTest' test
```

---

### Task 7：Status／REST／前端向後相容

**Files:**

- Modify: `src/main/java/tw/lawgraph/api/StatusMapper.java`
- Modify if needed: `src/main/java/tw/lawgraph/api/StatusSnapshot.java`
- Modify: `src/test/java/tw/lawgraph/api/StatusMapperTest.java`
- Modify: `src/test/java/tw/lawgraph/api/CaseControllerTest.java`
- Modify: `frontend-tests/views.test.mjs`
- Modify if source field displayed: `src/main/resources/static/js/views/result.js`
- Regenerate only through existing build script if required: `src/main/resources/static/js/app-bundle.js`

- [ ] **RED：Step 1，Research JSON 契約測試**

確認既有 laws、judgment 基本欄位仍存在；新增 coverage／sources 不改變 case status、step 或既有欄位名稱。

- [ ] **GREEN：Step 2，更新 mapper／DTO**

- [ ] **RED：Step 3，keyword-only 與 dual-source view 測試**

前端至少能顯示研究結果；若本階段不做來源徽章，也不得因新增欄位 render error。

- [ ] **GREEN：Step 4，最小前端相容修改**

不在本 Task 重設計頁面。

- [ ] **REFACTOR：Step 5，generated bundle 完整性**

若修改 source JS，使用既有 build 流程生成 bundle；不得手改 generated bundle。

- [ ] **Step 6，回歸**

```powershell
mvn -q '-Dtest=StatusMapperTest,CaseControllerTest' test
npm test
git diff --check
```

---

### Task 8：本機整合測試與全套回歸

**Files:**

- Create: `src/test/java/tw/lawgraph/mcp/DualMcpResearchIT.java`
- Create: `src/test/java/tw/lawgraph/mcp/TwLegalRagStubServer.java`
- Modify: `src/test/java/tw/lawgraph/mcp/LegalMcpIT.java`
- Create output directory only, not commit raw secrets: `artifacts/dual-mcp/`

- [ ] **RED：Step 1，完整雙軌 integration test**

legal-mcp 使用既有 Testcontainer；semantic 使用本機 Streamable HTTP stub。兩邊回同 JID，斷言 REST 最終只有一筆且 sources 含兩軌。

- [ ] **GREEN：Step 2，補足 wiring**

- [ ] **RED：Step 3，semantic unavailable integration test**

semantic stub 回 401／timeout；斷言 app 啟動、case 完成、coverage 正確。

- [ ] **GREEN：Step 4，補足 startup／fallback**

- [ ] **Step 5，全套 Java／Node tests**

```powershell
mvn test
mvn verify '-Dtest=LegalMcpIT,DualMcpResearchIT'
npm test
git diff --check
```

- [ ] **Step 6，本機真 MCP smoke（手動 gate）**

只有 `E2E_LIVE=1` 且 OAuth 已由使用者完成時執行。保存 sanitized artifact：兩軌 elapsed、候選數、merged JIDs、coverage；不保存 token／完整判決全文。

---

### Task 9：Zeabur 部署與 live 驗收

**Files:**

- Modify: `README.md`
- Modify: `CLAUDE.md`（只記非敏感部署設定名稱與驗證方式）
- Create: `docs/test-evidence/dual-mcp/M4-zeabur-live.md`
- Update: `docs/superpowers/specs/2026-09-03-dual-mcp-research-design.md` status

- [ ] **Step 1，部署前閘門**

確認 M0 OAuth／terms 結論、全套 tests、worktree scope、Docker build、CA trust 與 TLS 驗證皆通過。

- [ ] **Step 2，設定 Zeabur**

設定 base URL／feature flag／正式 security storage；敏感值只透過 Zeabur secret。不得在指令輸出、文件或截圖顯示 token。

- [ ] **Step 3，只部署 app service**

`legal-mcp` sidecar 無程式變更時不重佈。保存 deployment ID、commit SHA、服務狀態與實際 READY evidence。

- [ ] **Step 4，live keyword-only fallback case**

暫時讓 semantic unavailable，驗證網站仍完成且 coverage 為 unavailable；完成後還原設定。

- [ ] **Step 5，live dual-track case**

使用虛構案件，證明同一 correlation ID 下有 keyword＋semantic 兩軌、合併數與 dual-hit 數；結果 JID 不重複。

- [ ] **Step 6，AI 白名單驗收**

比對 analysis、documents、graph 中所有 law ref／judgment JID 均存在 merged research；不以「流程完成」代替法源白名單檢查。

- [ ] **Step 7，README／evidence**

更新架構、環境變數名稱、OAuth 操作、降級行為與限制；記錄 HTTP status、case ID、deployment ID、測試時間與 sanitized 摘要。

- [ ] **Step 8，規格狀態**

全部驗收通過後才將規格改為 Implemented；若 OAuth／terms 阻擋，維持 Draft／Blocked 並明列未完成項目，不把 keyword-only 報為雙軌完成。

---

## 4. Spec-to-test traceability

| 規格需求 | 主要測試 |
|---|---|
| 兩軌必須排程 | `DualMcpResearchServiceTest` barrier case |
| 不依賴 client 順序 | `McpClientRegistryTest` reversed-order case |
| JID/doc_id 去重 | `JudgmentMergeServiceTest` duplicate case |
| 合併輸出確定性 | `JudgmentMergeServiceTest` permutation case |
| 引用白名單／全文驗證 | semantic adapter fixture＋GraphRules tests |
| semantic 失敗降級 | service matrix＋`DualMcpResearchIT` 401/timeout cases |
| 法規不可幻覺 | agent prompt＋empty-laws tests |
| analyze 不繞過 merge | `LegalGraphAgentTest` tool exposure case |
| REST／前端相容 | `CaseControllerTest`＋Node view tests |
| OAuth／token 安全 | context test＋log assertions＋M4 deploy evidence |

## 5. 完成定義

- 所有 Task 的 RED failure 均曾被確認是預期缺口，而非測試本身錯誤。
- scoped tests、`mvn test`、指定 integration tests、`npm test` 與 `git diff --check` 全部通過。
- unit／integration tests 不依賴真 OAuth、真 OpenAI 或 public MCP。
- live 驗收有 raw/sanitized artifact，能證明雙軌呼叫、去重、fallback 與 AI 白名單。
- 沒有 token、authorization code、callback query 或真實案件內容進入 Git／log／文件。
- 文件、程式、Zeabur runtime 三者的 endpoint、工具名稱、feature flag 與行為一致。
- 未完成 OAuth 或服務條款閘門時，不宣稱 Zeabur semantic MCP 已完成。
