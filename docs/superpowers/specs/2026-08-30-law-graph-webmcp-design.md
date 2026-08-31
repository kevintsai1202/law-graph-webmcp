# law-graph-webmcp 設計規格

日期：2026-08-30
狀態：已與開發者逐段確認（5 段），待實作計畫
目標：OpenAI WebMCP Challenge 參賽作品（Devpost 截止 2026-09-03 13:00 PDT）

## 1. 目的與範圍

把 `law-powers` 法律分析技能包做成網站：使用者貼入案情（或點選示範案例），系統依「頭腦風暴 → 提問使用者 → 檢索法規判決 → 涵攝分析 → 產出法律關係圖」的標準流程，產生可互動的 3D 法律關係圖。頁面同時以 WebMCP 暴露工具，讓來訪的 AI Agent（ChatGPT 內建瀏覽器、Chrome 149+）能啟動流程、讀取結果、操作圖形；**回答系統提問這一步刻意保留給人**。

### 1.1 範圍內（參賽版）

- 純文字輸入＋四個可點選的虛構示範案例
- 中英雙語 UI 與 LLM 產出，預設英文
- 後端 Java：Spring Boot 4.1 ＋ Embabel 1.5.1 ＋ gpt-5.4-nano（2026-08-30 由 gpt-5.4-mini 降級以節省成本）
- 法律資料只接 `taiwan-legal-db`（非 RAG 的 MCP）
- 本機 Docker Compose ＋ Cloudflare Tunnel 上線
 - 十二個 WebMCP 工具（Imperative API）

### 1.2 範圍外

- 檔案上傳（PDF／DOCX）
- 帳號、持久化資料庫、歷史紀錄
- `dr-lawbot` 語意判例檢索（需互動式 OAuth，伺服器無法完成）
- Declarative API（`toolname` 表單屬性）——ChatGPT Site tools 不支援
- SVG 決策樹、程序時序（legal-graph 步驟四、五）

## 2. 架構

```text
瀏覽器 (HTML+JS, i18n, 3D renderer, WebMCP registerTool)
   │ REST: POST /api/cases · POST /api/cases/{id}/answers · GET /api/cases/{id}
   ▼
app  (Spring Boot 4.1 + Embabel 1.5.1, OpenAI gpt-5.4-nano, Skills ← /app/skills/*)
   │ Streamable HTTP MCP
   ▼
legal-mcp sidecar (Python 3.12, mcp-taiwan-legal-db)  ──▶ 司法院裁判書 / 全國法規資料庫
cloudflared ──▶ https://<domain>
```

### 2.1 已拍板的取捨

| 議題 | 決定 | 理由 |
|---|---|---|
| LLM | OpenAI `gpt-5.4-nano`（`embabel-agent-starter-openai`） | 成本優先；Embabel 1.5.1 `models/openai-models.yml` 內建 `gpt-5.4-nano`；品質不足時可改回 `gpt-5.4-mini` |
| Embabel 版本 | 1.5.1（Boot 4.1.0 / Spring AI 2.0.0 / Jackson 3） | 2026-08-24 發佈；新專案無 Boot 3 包袱 |
| 技能載入 | `embabel-agent-skills` 的 `Skills.withLocalSkill()`，以 `LlmReference` 掛進 PromptRunner | 113 KB SKILL.md 零改寫；模型透過 `activate()`／`readResource()` 讀完整指令與 `references/` |
| 流程結構 | 單一 Agent、五個 `@Action` ＋ 一個 `WaitFor.formSubmission` | 一條可預測的 GOAP 鏈，除錯簡單 |
| 進度取得 | 前端每 2 秒輪詢 `GET /api/cases/{id}` | 零依賴；WebMCP `getCaseStatus` 重用同端點；Agent 端只能輪詢 |
| Agent 角色 | 可啟動、可讀結果、可操作圖；**不可代答提問** | 「人不可被繞過」是設計亮點，也符合法律場域對人為確認的要求 |
| Python | 必要，但隔離在 sidecar 容器 | `mcp-taiwan-legal-db` 為 FastMCP Python 套件，含 F5 WAF 的 Playwright fallback；純 Java 重寫不划算 |
| 前端 | 純 HTML＋原生 JS，無 build | 現有渲染器即為無框架單檔；React 無增益 |
| 部署 | 本機 Docker Compose ＋ Cloudflare Tunnel | 風險最小；Tunnel 提供 HTTPS（WebMCP 需 secure origin） |
| 狀態儲存 | 記憶體 `ConcurrentHashMap`，`caseId` ＝ Embabel `processId` | 參賽版接受重啟清空 |

## 3. 資料契約

### 3.1 REST 端點

| 方法 | 路徑 | 請求 | 回應 |
|---|---|---|---|
| `POST` | `/api/cases` | `{ caseText, locale }` | `201 CaseStatus` |
| `GET` | `/api/cases/{id}` | — | `CaseStatus`；不存在 `404` |
| `POST` | `/api/cases/{id}/answers` | `{ answers: [{ questionId, answer }] }` | `CaseStatus`；非 `WAITING` 回 `409` |
| `GET` | `/api/samples?locale=en\|zh-TW` | — | `[{ id, title, summary, text }]` |
| `GET` | `/api/laws/verify?ref=` | 條號或裁判字號（原文） | `{ ref, exists, source, snippet }` |

`POST /api/cases` 限流：每 IP 每小時 10 次，超過回 `429`。

### 3.2 `CaseStatus`

```json
{
  "caseId": "string (= Embabel processId)",
  "status": "RUNNING | WAITING | COMPLETED | FAILED",
  "step":   "BRAINSTORM | QUESTIONS | RESEARCH | ANALYSIS | GRAPH",
  "locale": "en | zh-TW",
  "questions": [ { "id": "q1", "text": "…", "why": "…" } ],
  "result":    { "brainstorm": {}, "research": {}, "analysis": {}, "graph": {} },
  "error":     { "code": "…", "message": "…", "step": "…" }
}
```

`questions` 僅於 `WAITING`；`result` 僅於 `COMPLETED`；`error` 僅於 `FAILED`。

### 3.3 領域型別（Java record；同時是 Embabel Action 的輸入輸出）

```text
CaseInput        { text, locale }
BrainstormResult { facts[], relations[], issues[], evidenceNeeds[], questions[]{ id, text, why } }
UserAnswers      { answers[]{ questionId, answer } }
ResearchResult   { laws[]{ ref, title, articleText, source },
                   judgments[]{ jid, citation, court, date, summary, url },
                   notes[] }
AnalysisResult   { elements[]{ law, element, met: yes|no|unknown, basis, fact },
                   strategy, evidenceGaps[], disclaimer }
GraphData        { nodes[], edges[] }   // 與 law-powers data.js superset schema 100% 相容
```

### 3.4 硬規則（在 Java 層執行，不依賴 prompt）

1. **檢索錨定**：`GraphData` 中 `group ∈ {law, judgment}` 的節點，其 `ref`／`jid` 必須存在於 `ResearchResult`；否則剔除該節點及其連線，並將剔除項寫入 `ResearchResult.notes`。
2. **涵攝結果單一來源**：`element` 節點的 `met` 一律以 `AnalysisResult.elements` 的 `(law, element)` 對映覆寫；建圖 prompt 不得自行給值。
3. **連線標籤白名單**：`edges[].label` 以 enum 序列化，限 legal-graph 定義之字串：適用、引用、刑事附帶民事 (民附)、上訴、連帶責任/保證、抗辯/阻斷、保全/假扣押、法條關聯、當事人、證據、包含、課予、負擔、得請求、對價、違約效果、要件、該當、要件認定。不合法值丟棄該筆邊。

### 3.5 語系規則

- `locale` 進 `CaseInput` 後隨 blackboard 傳遍所有 Action；每個 Action 的 prompt 尾端加 `Respond in {locale}.`
- `questions[].text`／`why`、`AnalysisResult` 文字、`GraphData.nodes[].label`／`description` 依 locale 產生
- 法條與裁判字號**一律雙寫、不受 locale 影響**：`"Civil Code Art. 184 ¶1（民法第184條第1項）"`、`"Supreme Court 108-Tai-Shang-2345（最高法院108年度台上字第2345號）"`。原文部分是硬規則 1 的比對鍵。
- WebMCP 工具的 `name`／`description`／`inputSchema` 固定英文。

## 4. Embabel Agent

### 4.1 Action 鏈

```text
CaseInput ─brainstorm─▶ BrainstormResult ─askUser─▶ UserAnswers
  ─research─▶ ResearchResult ─analyze─▶ AnalysisResult ─buildGraph─▶ GraphData (@AchievesGoal)
```

| @Action | 輸入 → 輸出 | 啟用技能 | 工具 | LLM |
|---|---|---|---|---|
| `brainstorm` | `CaseInput → BrainstormResult` | `legal-brainstorming` 步驟一～四 | 無 | mini |
| `askUser` | `BrainstormResult → UserAnswers` | — | `WaitFor.formSubmission(questions, UserAnswers.class)` | 不呼叫 |
| `research` | `CaseInput + BrainstormResult + UserAnswers → ResearchResult` | `legal-research` 步驟一～四（略過步驟零與 dr-lawbot 語意軌） | `taiwan-legal-db` 群組 | mini |
| `analyze` | `ResearchResult + BrainstormResult → AnalysisResult` | `legal-element-analysis` | `query_regulation`、`get_judgment` | mini |
| `buildGraph` | 全部 → `GraphData` | `legal-graph` 步驟一～三 | 無 | mini |

`askUser`：`questions` 為空時回傳空 `UserAnswers` 直接續跑。

### 4.2 技能掛載

```java
@Bean
Skills lawPowersSkills(@Value("${lawgraph.skills-dir}") String dir) {
    return new Skills("law-powers", "Taiwan legal analysis skills")
        .withLocalSkill(dir + "/legal-brainstorming")
        .withLocalSkill(dir + "/legal-research")
        .withLocalSkill(dir + "/legal-element-analysis")
        .withLocalSkill(dir + "/legal-graph");
}
```

- 技能目錄為 git submodule → `kevintsai1202/law-powers`，Docker build `COPY skills/ /app/skills/`
- 只掛四個；`legal-writing-humanizer-workspace` 無 SKILL.md 會讓 loader 失敗，不可用 `withLocalSkills(parent)` 整目錄掃描
- `DefaultDirectorySkillDefinitionLoader` 的檔案引用驗證保持開啟，當作 CI 檢查
- 每個 Action 的 user prompt 首句固定：`Activate skill "<name>" and follow its steps N–M. Output only the requested object.`

### 4.3 共用 system prompt（所有 Action 相同，利於 prompt cache）

1. 工具名對映：技能中 `taiwan-legal-db:<tool>` 即本環境的 `<tool>`
2. `dr-lawbot` 不可用；依技能降級規則走 `search_judgments` 關鍵字單軌，並在 notes 註明語意檢索未啟用
3. 技能要求「詢問使用者」時不得直接發問，改寫入 `questions[]`
4. `Respond in {locale}.` 與第 3.5 節識別碼雙寫規則
5. 免責聲明：輸出為分析輔助，非法律意見

### 4.4 MCP 工具群組

```yaml
spring.ai.mcp.client:
  type: SYNC
  request-timeout: 60s
  streamable-http:
    connections:
      legal-mcp: { url: ${LEGAL_MCP_URL:http://legal-mcp:8000} }   # Spring AI 以 url ＋ 預設 endpoint /mcp 連線
```

`McpToolGroup("taiwan-legal-db", …)` 白名單：`search_regulations`、`query_regulation`、`get_pcode`、`search_judgments`、`get_judgment`、`get_citations`。不開 `search_interpretations`／`get_interpretation`。

### 4.5 錯誤與逾時

| 情況 | 處置 |
|---|---|
| MCP 逾時／WAF 擋 | `research` 重試 1 次；仍失敗則 `notes` 記「檢索不完整」續跑，相關節點由硬規則 1 剔除 |
| LLM 輸出不合 schema | Embabel `createObject` 內建重試；耗盡 → `FAILED` 並附 `step` |
| 單一 case > 5 分鐘 | 前端顯示逾時提示；後端 process 不砍 |
| 使用者未回答 | process 停在 `WAITING`，不做逾時回收 |

### 4.6 成本護欄

`LlmOptions.maxTokens`：brainstorm 4k、research 8k、analyze 6k、buildGraph 8k。每 case 約 US$0.3–0.5。

## 5. WebMCP 工具集

原則：全部 `document.modelContext.registerTool()`；契約英文；`locale` 為參數；**無 `submitQuestions` 工具**；`fillQuestions` 只填入可見欄位，送出仍需人確認；工具清單隨頁面狀態同步，避免 Agent 取得舊狀態工具；description ≤ 150 字、name ≤ 30 字；單次回傳 ≤ 1.5K 字元。

| 工具 | 可用頁面狀態 | 輸入 | 回傳 | annotations |
|---|---|---|---|---|
| `listSampleCases` | `INPUT` | `{ locale? }` | `[{ id, title, summary }]` | readOnlyHint |
| `startCase` | `INPUT` | `{ caseText, locale }` 或 `{ sampleId, locale }` | `{ caseId, status, step }` | — |
| `getCaseStatus` | `RUNNING`／`QUESTIONS`／`RESULT`／`FAILED` | `{}` | `CaseStatus`（省略 `result.graph`） | readOnlyHint |
| `getQuestions` | `QUESTIONS` | `{}` | 題目、`questionId`、提問原因與 `fillQuestions` 輸入範例 | readOnlyHint |
| `fillQuestions` | `QUESTIONS` | `{ answers: [{ questionId, answer }] }` | `{ ok, submitted: false, appliedQuestionIds[], missingQuestionIds[] }`；依 `getQuestions` 的 `questionId` 填入頁面欄位，若沒有實際套用則回報錯誤，且不送出 | — |
| `getAnalysis` | `RESULT` | `{ section: brainstorm\|research\|analysis }` | 該段 JSON；超長回摘要＋`truncated: true` | readOnlyHint, untrustedContentHint |
| `getGraphSummary` | `RESULT` | `{}` | `{ nodeCounts, edgeCounts, topIssues[], unmetElements[] }` | readOnlyHint |
| `focusNode` | `RESULT` | `{ nodeId }` 或 `{ label }` | `{ node, neighbors[] }`；鏡頭飛至節點並開詳情面板 | — |
| `filterGraph` | `RESULT` | `{ groups?, family?, reset? }` | `{ visibleNodes, visibleEdges }` | — |
| `explainEdge` | `RESULT` | `{ sourceId, targetId }` | `{ label, rel?, title, sourceLabel, targetLabel }` | readOnlyHint |
| `verifyCitation` | `INPUT`／`RESULT` | `{ ref }` | `{ ref, exists, source, snippet }` | readOnlyHint |
| `resetCase` | `RUNNING`／`QUESTIONS`／`RESULT`／`FAILED` | `{}` | `{ ok }` | — |

狀態矩陣：`INPUT` = `listSampleCases`、`startCase`、`verifyCitation`；`RUNNING` = `getCaseStatus`、`resetCase`；`QUESTIONS` = `getCaseStatus`、`getQuestions`、`fillQuestions`、`resetCase`；`RESULT` = `getCaseStatus`、三個分析／摘要工具、四個圖／引用工具與 `resetCase`；`FAILED` = `getCaseStatus`、`resetCase`。`QUESTIONS` 不暴露 `startCase` 或 `submitQuestions`；Agent 先以 `getQuestions` 取得題目對照，再填入建議答案，但人必須檢查並送出。實作以每一狀態一個 `AbortController` 管理註冊；`syncForState()` 切換時先 abort 舊清單；`execute` 只呼叫前端領域函式（`caseClient.*`、`graphView.*`），不碰 DOM selector；`document.modelContext` 不存在時略過註冊但 Inspector 仍顯示同一狀態矩陣。

### 5.1 典型旅程（影片腳本骨架）

```text
使用者(ChatGPT)：口述車禍案情
Agent → startCase({caseText, locale:"en"})        → RUNNING/BRAINSTORM
Agent → getCaseStatus() ×N                        → WAITING, questions[...]
      → getQuestions() → fillQuestions()          → human reviews and submits
Agent：轉述問題，請使用者在頁面作答               ← 人作答並送出
… → COMPLETED
Agent → getGraphSummary() → focusNode({label:"Civil Code Art. 217"}) → verifyCitation({ref:"民法第217條"})
Agent：解讀過失相抵對本案的影響
```

## 6. 前端

### 6.1 檔案佈局（`src/main/resources/static/`，無 build）

```text
index.html
css/app.css
js/app.js            狀態機、view 路由、廣播輪詢結果
js/i18n.js           en / zh-TW 字典、t(key)、localStorage
js/caseClient.js     start / status / answer / samples / verify；2 秒輪詢
js/views/input.js    文字框 + 4 示範案例卡
js/views/progress.js 五步進度列
js/views/questions.js WaitFor 表單（每題 textarea + why）
js/views/result.js   分頁：Graph / Analysis / Research / Brainstorm
js/graphView.js      包裝 law-powers 渲染器：render / focus / filter / explainEdge
 js/webmcp.js         十二個工具，委派 caseClient / app / graphView
js/inspector.js      折疊式 Tool Inspector 面板（手動執行工具）
vendor/              three.min.js, 3d-force-graph.min.js, three-spritetext.min.js（自 law-powers/lib 複製）
```

### 6.2 狀態機

```text
INPUT ─start─▶ RUNNING ─WAITING─▶ QUESTIONS ─submit─▶ RUNNING ─COMPLETED─▶ RESULT
                  └──────────────── FAILED（step + 重試）◀────────────────┘
```

`caseId` 存 `sessionStorage`，重新整理後續接輪詢。

### 6.3 渲染器改造

自 law-powers `index.html` 只抽**應用層 JS**（`renderNetwork`、詳情面板、群組配色、家族聚焦）成 `graphView.js`；三個 lib 外部化至 `vendor/`。改動：

1. `renderNetwork(window.GRAPH_DATA)` 自動呼叫 → `export function render(data)`，可重複呼叫（先清空 `graphData`）
2. 新增 `focus(id)`（`cameraPosition` ＋ 開面板）、`filter({groups|family|reset})`（既有家族聚焦的程式化入口）、`explainEdge(s, t)`
3. 渲染器不翻譯節點文字；UI chrome 走 `i18n.js`

### 6.4 i18n

- 預設 `en`；`navigator.language` 以 `zh` 開頭且使用者未選過 → `zh-TW`
- 切換語系不重跑 case，只換 UI 文案，結果頁顯示「Generated in {locale}」
- 示範案例兩語各一份

### 6.5 示範案例（虛構，每案 200–300 字，刻意留白以觸發提問）

| # | 案例 | 涵蓋 |
|---|---|---|
| 1 | 機上盒公開傳輸侵權（改寫 law-powers 現有 `data.js`） | 著作權法 §87／§88／§92、刑事附帶民事、上訴審級 |
| 2 | 十字路口車禍求償 | 民法 §184／§191-2／§217、§197 時效 |
| 3 | 租屋押金與提前解約 | 民法 §421～§450、土地法 §99；契約→條款→義務 |
| 4 | 試用期滿解僱 | 勞基法 §11／§12／§16／§17 |

## 7. 測試

| 層 | 工具 | 範圍 | 打外部 |
|---|---|---|---|
| 領域規則 | JUnit 5 | 四條硬規則、`CaseStatus` 序列化 | 否 |
| Action 契約 | JUnit 5 ＋ Embabel 測試支援（fake context / prompt runner） | 型別串接、prompt 含 activate 句 | 否 |
| REST | `@WebMvcTest` | 五端點、409、429 | 否 |
| MCP 連線 | `@SpringBootTest` ＋ Testcontainers 起 `legal-mcp` | `search_regulations("民法")` 回 pcode；WAF 失敗以假 server 模擬 | 只 sidecar |
| 前端純函式 | `node --test` | `i18n.t`、狀態機、工具 schema、1.5K 截斷 | 否 |
| E2E | Playwright（`e2e/`，可重跑） | 示範案例→WAITING→作答→COMPLETED→圖有節點→Inspector 執行 `focusNode` | 真 LLM，僅 `E2E_LIVE=1` |

品質評估：`scripts/eval-samples.mjs` 對四個示範案例各跑一次，輸出存 `eval/`，統計硬規則剔除數。

## 8. 容器與部署

```yaml
services:
  app:         # 多階段 Dockerfile：maven 建置 → eclipse-temurin:21-jre；COPY jar + skills/
    environment: [OPENAI_API_KEY, LEGAL_MCP_URL=http://legal-mcp:8000, LAWGRAPH_SKILLS_DIR=/app/skills]
    depends_on: { legal-mcp: { condition: service_healthy } }
  legal-mcp:   # python:3.12-slim；pip install mcp-taiwan-legal-db playwright；playwright install --with-deps chromium
    environment: [FASTMCP_HOST=0.0.0.0, FASTMCP_PORT=8000]   # mcp<2 的 FastMCP 以環境變數設 host/port
    command: python -c "from mcp_server.server import mcp; mcp.run(transport='streamable-http')"
    healthcheck: curl -f http://localhost:8000/mcp
    volumes: [legal-cache:/app/mcp_server/data]
  cloudflared: # cloudflare/cloudflared；tunnel run --token ${CF_TUNNEL_TOKEN}
```

長時指令（`mvn verify`、`docker compose build`）輸出 `tee` 至 `logs/`。

## 9. 驗收清單

**功能**
- [ ] 四個示範案例在 en／zh-TW 各跑完，圖含 fact／law／issue／element 四類節點
- [ ] 每案例至少觸發一次 WAITING
- [ ] 硬規則剔除項列於 `research.notes`
- [ ] 無 WebMCP 瀏覽器可完整走完；Inspector 依頁面狀態只顯示並可手動執行該狀態工具

**WebMCP**
- [ ] Chrome 149 flag：`INPUT`／`RUNNING`／`QUESTIONS`／`RESULT`／`FAILED` 的 `getTools()` 分別符合狀態矩陣，切換後不殘留舊工具
- [ ] ChatGPT 桌面版：Site tools 列出工具；`startCase`→轉述問題→人作答→`focusNode` 全程錄影
- [ ] `getAnalysis` 單次 ≤ 1.5K 字元

**參賽交付**
- [ ] Live URL（Cloudflare Tunnel HTTPS）
- [ ] repo 公開、`LICENSE`（MIT）顯示於 About；law-powers 以 submodule 引用，其授權條款原樣保留並於 README 說明
- [ ] README：架構圖、為何用 WebMCP、人機共同完成了什麼、`registerTool` 範例、本機啟動、免責聲明（非法律意見／示範案例虛構／勿貼真實個資）
- [ ] < 3 分鐘 YouTube 影片
- [ ] Devpost 送出

## 10. 時程

| 日 | 交付 |
|---|---|
| D1 | 骨架、submodule、Embabel＋OpenAI 一個 Action 跑通、legal-mcp 連通 |
| D2 | 五 Action ＋ WaitFor 全鏈路（假 LLM 測試綠）；真 LLM 跑示範案例 1 |
| D3 | 前端四狀態 ＋ 渲染器抽離 ＋ i18n；四個示範案例文案 |
| D4 | WebMCP 十工具 ＋ Inspector；Chrome flag 與 ChatGPT 實測；compose ＋ Tunnel 上線 |
| D5 | eval 調 prompt、README、錄影、Devpost 送出 |

## 11. 已知風險

| 風險 | 緩解 |
|---|---|
| gpt-5.4-mini 法律推理品質不足 | 硬規則 1–3 在程式層兜底；eval 腳本量化剔除率；prompt 只在 D5 微調 |
| 司法院 WAF 導致檢索間歇失敗 | sidecar 內建 Playwright fallback；`research` 重試 1 次；失敗可降級續跑 |
| Embabel 1.5.1 為新版，Skills／Streamable HTTP 文件可能與行為有落差 | D1 先以最小範例驗證兩者；落差時退回 stdio（app 容器加 Python）為備案 |
| ChatGPT Site tools 對工具數或回傳大小另有限制 | 十工具皆 ≤ 1.5K；D4 實測後可合併 `explainEdge` 進 `focusNode` |
| 時程僅 5 天 | 範圍已刪至最小；D5 保留半天緩衝；上傳、SVG、持久化皆列範圍外 |
