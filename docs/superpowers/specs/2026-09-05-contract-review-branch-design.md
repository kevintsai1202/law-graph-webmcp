# 合約審查分支＋首頁雙入口＋使用統計 設計規格

日期：2026-09-05
狀態：使用者已於對話中核准設計草案與預設值；本文件為定稿。

## 1. 目標

1. 網站首頁改為「能力入口」：進站先看到兩張能力卡片（案件分析、合約審查），點選後進入各自的 Agent 流程。
2. 新增第二條 Agent 流程「合約審查」，把 law-powers 技能包的 `compliance-verification`（合約審查與合規驗證）三步驤（載入 → 法規對照 → 風險報告）轉為型別化的 Embabel Action 鏈，產出紅黃綠風險條款清單、修改建議、修訂版條款與契約義務關係圖。
3. 兩條流程的畫面骨架、進度條、問答頁、結果分頁、失敗頁、WebMCP 工具風格完全一致。
4. 新增使用統計：每日被使用總次數（含依模式拆分）與每日耗費 tokens，所有使用數據落在 PostgreSQL，重佈不歸零；提供 API 與統計頁。

## 2. 非目標

- 不改動既有案件分析流程的法律邏輯與 prompt 內容（只在 system prompt 第 8 條加入 `<contract>` 標籤宣告）。
- 不做管理者登入；統計頁對所有人唯讀公開（不含任何個人識別資料）。
- 不引入前端框架或圖表套件；統計圖用純 CSS 長條。

## 3. 現況依據

- Agent：`LegalGraphAgent`（Embabel GOAP，單一 goal `buildGraph`），`CaseService.start` 以 `AGENT_NAME` 挑 agent。GOAP 規劃期無資料，資料驅動的 `@Condition` 分支會讓案件 STUCK（2026-09-04 實測），因此分支必須以獨立 agent 實作。
- `SkillsConfig.SKILL_NAMES` 只載入四個技能，尚未載入 `compliance-verification`。
- `GraphRules.VALID_GROUPS` 與 `graphView.js` 已支援 `contract`／`clause`／`obligation` 節點及 `clause.risk` 三色，無需修改渲染器。
- 附件擷取 `CaseFileExtractor`（PDF／DOCX／MD）可直接供合約上傳使用。
- 用量：`usage_daily` 資料表（JdbcUsageStore）只存每日 prompt／completion tokens；`DailyCaseQuota`、`LlmUsageStats` 皆為記憶體，重啟歸零。
- 前端：`state.js` 純函式狀態機（INPUT／RUNNING／QUESTIONS／RESULT／FAILED），`app.js` 依 view 渲染，`sessionStorage` 存 caseId 供 F5 續接；`i18n.js` 中英鍵集合有測試守著必須一致。

## 4. 前端設計

### 4.1 狀態機與路由

- `States` 新增 `HOME`、`STATS`；`initialState.view = HOME`。
- 狀態新增 `mode` 欄位：`'case'`／`'contract'`／`null`。事件新增 `SELECT_MODE {mode}` → view INPUT；`SHOW_STATS` → view STATS；`RESET` 回 HOME 且 mode 清空。`START` 事件帶 `mode`。
- hash 路由：`#/`（HOME）、`#/case`、`#/contract`、`#/stats`。`app.js` 監聽 `hashchange`，載入時依 hash 決定初始 view；`sessionStorage` 同時存 `caseId`、`mode`、`outputs`，F5 續接時依 `mode` 進入對應流程的 RUNNING／QUESTIONS／RESULT。
- 頂欄新增「統計」連結（`#/stats`）與「回首頁」品牌連結（點 Law Graph 標題回 `#/`）。

### 4.2 首頁（HOME）

- 兩張等寬能力卡片（沿用 `.card` 樣式，桌機並排、手機直排），每張含圖示（SVG，不用 emoji）、標題、一行描述、流程步驤小字（七步）、按鈕「開始」。
  - 案件分析：糾紛案情 → 法源檢索 → 涵攬 → 抗辯評估 → 書狀 → 關係圖。
  - 合約審查：合約原文或商業行為描述 → 法規對照 → 紅黃綠風險條款 → 修改建議 → 契約義務圖。
- 首頁下方顯示既有配額列（今日已分析 n / N）與授權說明側欄內容不變。

### 4.3 輸入頁（INPUT）

- 共用 `renderInput`，依 `mode` 切換：標題、placeholder、示範案例來源、輸出勾選項、額外欄位。
- 合約模式額外欄位：
  - 我方立場 radio：甲方／乙方／不確定（送 `party`）。
  - 審查範疇 checkbox（可多選、可全不選交由 LLM 判定）：一般商務契約（民法債編）、勞動契約（勞基法）、行銷與個資（個資法）、公司治理（公司法）（送 `scopes`）。
  - 輸出勾選：`revised`（修訂版條款，可選）。風險清單、合規摘要、關係圖必出，不列勾選。
- 商業行為審查併入合約入口：允許純文字不附檔，最少字數沿用 MIN_CHARS 規則（有附件時不強制）。
- 示範案例：合約模式兩個（勞動契約、軟體委託開發契約），走既有 `SamplesController` 機制，samples JSON 每筆加 `mode` 欄位，`/api/samples?mode=contract` 過濾。

### 4.4 進度頁

- `renderProgress` 依 mode 取步驤鍵：`progress.case.*` 與 `progress.contract.*` 各七步，視覺完全相同。合約步驤鍵：`LOAD`、`QUESTIONS`、`RESEARCH`、`REVIEW`、`SUMMARY`、`REVISE`、`GRAPH`。

### 4.5 結果頁

- 合約模式分頁順序：`findings`（風險條款清單）、`summary`（合規摘要）、`doc-revised`（修訂條款對照，勾選才出）、`graph`（關係圖）、`laws`（引用法源）。
- 風險條款清單：表格欄位「條款編號｜條款原文｜風險｜法規依據｜風險點｜修改建議｜佐證判決」，風險欄以 🔴🟡🟢 色塊加文字（不只靠顏色）；可 CSV 匯出（沿用 `checklistCsv` 的防公式注入轉義）；表頭提供風險篩選按鈕（全部／高／中／低）。
- 合規摘要：整體風險等級、優先修改順序清單、審查範疇、免責聲明。
- 修訂條款對照：兩欄表「原條款｜修訂後」逐條。
- 關係圖：沿用 graph 分頁與 `graphView`；圖例新增 contract／clause／obligation 與風險色說明。

### 4.6 統計頁（STATS）

- 呼叫 `GET /api/stats?days=30`。顯示：
  - 今日摘要卡：今日案件數（案件分析 n／合約審查 m）、今日 tokens（prompt／completion／合計）。
  - 近 30 日表格：日期｜總次數｜案件分析｜合約審查｜完成｜失敗｜prompt｜completion｜合計 tokens。
  - 純 CSS 長條圖兩張：每日次數、每日 tokens（`div` 寬度百分比，附 `aria-label` 數值）。
- 不含 IP、email、案情內容。

### 4.7 WebMCP

- 新增工具：`listCapabilities`（base，唯讀）、`selectCapability {mode}`（base）、`startContractReview {contractText, party, scopes, outputs, locale}`（base）、`getComplianceReport`（completed，唯讀，untrustedContentHint）、`filterFindingsByRisk {risk}`（completed）、`getUsageStats {days}`（base，唯讀）。
- 既有 `getInputForm`、`getCaseStatus`、`getResultTabs` 回傳值加 `mode`。`startCase` 維持只啟動案件分析。
- 工具總數 16 → 22。改碼後 `npm run bundle`。

### 4.8 i18n

- 所有新鍵中英同時新增；既有 `progress.*` 鍵改名為 `progress.case.*` 並更新用到的地方。

## 5. 後端設計

### 5.1 ContractReviewAgent

`@Agent(name = "ContractReviewAgent")`，Action 鏈：

| 步驤 | Action | 輸入 → 輸出 | 說明 |
|---|---|---|---|
| LOAD | `loadContract` | ContractInput → ContractBrainstorm | 判定契約類型、審查範疇（使用者勾選優先，未勾選由 LLM 判定）、切分條款清單（clauseNo、text）、當事人與地位、待問問題（≤5） |
| QUESTIONS | `askUser`／`assessSecondRound`／`askSecondRound`／`assessThirdRound`／`askThirdRound`／`finalizeClarification` | 與案件流程相同型別 | 直接重用三個 Awaitable 與 `ClarifiedAnswers`；clarify prompt 改用合約版 |
| RESEARCH | `planResearch` → `prepareSemanticQuery` → `research` | → ResearchPlan → SemanticQuery → ResearchResult | 重用 `DualMcpResearchService`。合約版 prompt 要求 regulationQueries 必含民法 71、247-1 與範疇對應法條；判決查詢新增 `mainText` 篩選（見 5.4）；`semanticCaseText` 放契約摘要 |
| REVIEW | `reviewClauses` | ResearchResult＋ContractBrainstorm → ClauseFindings | 每批 ≤15 條分批呼叫 LLM，Java 合併；每條產出 ClauseFinding；只能引用檢索白名單法源，經 `TaiwanTerminology.sanitize` |
| SUMMARY | `summarizeCompliance` | ClauseFindings → ComplianceReport | 整體風險等級（取最高）、優先修改順序、審查範疇、免責聲明（agents-rules §4 文字） |
| REVISE | `reviseClauses` | ComplianceReport＋ContractInput → RevisedClauses | 未勾選 `revised` 時回空、不呼叫 LLM；勾選時只針對 high／medium 條款產出修訂文 |
| GRAPH | `buildContractGraph`（`@AchievesGoal`） | → GraphOutcome | LLM 產 GraphData（contract／party／clause／obligation／law），Java 以 findings 覆寫 `clause.risk` 與 description，再過 `GraphRules.apply` |

模型選擇沿用 `llm(context)` 的 `CaseInput.model` 覆寫邏輯（改為讀 `ContractInput.model`）。

### 5.2 新增 domain record

- `ContractInput(text, locale, party, scopes, outputs, model)`：`party` ∈ {`partyA`,`partyB`,`unknown`}；`scopes` 白名單 {`commercial`,`labor`,`privacy`,`corporate`}；`outputs` 白名單 {`revised`}。建構時正規化。
- `ContractBrainstorm(contractType, scopes, parties: List<ContractParty>, clauses: List<Clause>, questions: List<Question>, summary)`；`ContractParty(name, role)`；`Clause(clauseNo, text)`。
- `ClauseFinding(clauseNo, clauseText, risk: Risk, lawRefs: List<String>, riskPoint, suggestion, judgmentCitations: List<String>)`：引用以字串逐字複製 research.laws[].ref／judgments[].citation，由 Java 依白名單過濾（比要模型填整個 LawRef 物件更不易幻覺）。
- `ClauseFindings(findings)`（批次合併結果）。
- `ComplianceReport(contractType, scopes, overallRisk: Risk, findings, priorities: List<String>, disclaimer)`。
- `RevisedClauses(items: List<RevisedClause>)`；`RevisedClause(clauseNo, original, revised, rationale)`。
- 所有 record 對 null 清單兜底成空（沿用 `CaseAssessment` 寫法）。

### 5.3 共用層調整

- `CaseController.StartRequest` 新增 `mode`（預設 `case`）、`party`、`scopes`；multipart 同步。`mode=contract` 時建 `ContractInput`。`outputs` 欄位沿用 `documents` 參數名以相容 WebMCP／前端既有呼叫。
- `CaseService.start(...)` 依 mode 對映 agent 名稱；`locales` 旁新增 `modes` map。
- `StatusSnapshot` 新增 `mode`、`contractBrainstorm`、`findings`、`compliance`、`revised` 欄位；`StatusMapper.deriveStep` 依 mode 分兩套。`CaseStatus` 新增 `mode`；`CaseStatus.Result` 新增 `compliance`、`revised`、`contract`（NON_NULL）。
- `LegalPrompts.system` 第 8 條加入 `<contract>`；新增 `ContractPrompts` 類別放合約版 prompt（load／clarify／research／review／summarize／revise／graph），與 `LegalPrompts` 共用 system。
- `SkillsConfig.SKILL_NAMES` 加入 `compliance-verification`。
- `StepWatchdog`、配額、token 預算、`AccessPolicy`、`RateLimiter` 不改，自動涵蓋。

### 5.4 判決輸贏方篩選

- `ResearchPlan.JudgmentKeywordQuery` 新增 `mainText` 欄位（選填）；`McpTaiwanLegalDbAdapter` 有值時帶入 `search_judgments` 的 `main_text` 參數。既有案件流程 prompt 不強制填。

### 5.5 使用統計（全部落資料庫）

**資料表**（DDL 標準 SQL，測試以 H2 驗證）：

- `case_event`：`case_id VARCHAR PK`、`usage_day VARCHAR(10)`、`mode VARCHAR(16)`、`identity_kind VARCHAR(16)`（anonymous／member）、`identity_hash VARCHAR(64)`（SHA-256，供配額計數，不存原始 IP／sub）、`model VARCHAR(64)`、`status VARCHAR(16)`（RUNNING／COMPLETED／FAILED）、`prompt_tokens BIGINT`、`completion_tokens BIGINT`、`started_at TIMESTAMP`、`finished_at TIMESTAMP NULL`。索引 `(usage_day)`、`(identity_hash, usage_day)`。
- `member`：`google_sub VARCHAR(64) PK`、`email VARCHAR(255)`、`display_name VARCHAR(255)`、`picture_url VARCHAR(1024)`、`first_login_at TIMESTAMP`、`last_login_at TIMESTAMP`、`login_count INT`、`blocked BOOLEAN`、`blocked_reason VARCHAR(255)`。不存 access／id token。每次 OAuth 登入成功（`OAuth2LoginSuccessHandler`／`OidcUserService` 包裝）upsert 一列並累加 `login_count`；`AccessPolicy` 命中時寫入 `blocked`。`case_event.identity_hash` 對會員存 `"user:<google_sub>"` 的 SHA-256 雜湊（`identity_kind=member`），匿名為 `"ip:<ip>"` 的 SHA-256 雜湊；兩者用同一個雜湊函式，資料庫不落地任何原文。
- 會員資料保存期限：`last_login_at` 起 12 個月無活動即刪除（每日排程 `MemberRetentionJob`，`LAWGRAPH_MEMBER_RETENTION_DAYS` 預設 365），個資告知只對**首次建立的帳號**顯示一次：`member` 新增 `notice_acknowledged_at TIMESTAMP NULL`；登入成功時若是新建列，`GET /api/me` 回 `firstLogin=true`，前端在頂欄下方顯示可關閉的告知卡（收集目的：身分識別與配額；欄位：Google email、名稱、頭像；保存期限；刪除方式，i18n `privacy.notice.*`），按「我知道了」呼叫 `POST /api/me/notice-ack` 寫入時間戳，之後登入不再顯示；登入按鈕旁不放告知文字；提供 `DELETE /api/me` 讓已登入者自行刪除帳號與其 case_event 關聯（identity_hash 置空）——但只清「今天之前」的列，當日的列保留身分雜湊，否則刪帳號後重新登入即可把當日配額歸零；保存期限排程 `MemberRetentionJob` 才做全量去識別化（含當天）。
- `usage_daily`：保留並新增欄位 `llm_calls BIGINT`、`cached_tokens BIGINT`、`reasoning_tokens BIGINT`（`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，H2 與 PostgreSQL 皆支援）。

**元件**：

- `UsageEventStore` 介面（jdbc／memory 兩實作）：`recordStart(CaseEvent)`、`recordTokens(caseId, prompt, completion)`（累加）、`recordFinish(caseId, status)`、`countToday(identityHash, day)`、`dailyStats(from, to)`。
- `TokenUsageListener` 除累加 `DailyTokenBudget` 外，依 `AgentProcessEvent` 的 process id 呼叫 `recordTokens`；流程結束事件呼叫 `recordFinish`。
- `DailyCaseQuota` 改以 `UsageEventStore.countToday` 為準（有 DB 時），記憶體實作保留給無 DB 環境；`tryAcquire` 成功即 `recordStart`。
- `LlmUsageStats.record` 同步把 calls／cached／reasoning 累加進 `usage_daily`（透過 `UsageStore` 擴充 `DailyUsage` 欄位）。
- `StatsController`：`GET /api/stats?days=30`（上限 90）回 `{ days: [{day, total, byMode:{case,contract}, byIdentity:{anonymous,member}, completed, failed, promptTokens, completionTokens, totalTokens}], today: {...}, members: {total, activeToday} }`；速率限制以專屬 `statsRateLimiter`（`lawgraph.stats-rate-limit-per-hour`，預設 120／IP／小時）擋下，超限回 `429 RATE_LIMITED`。
- 無 DB（`LawGraphDatabase.optional()` 為空）時全部退回記憶體實作並在啟動 log WARN 一次；正式環境已設 `LAWGRAPH_DB_URL`。

## 6. 錯誤處理

- 合約流程各步驤逾時：沿用 `StepWatchdog`，訊息以合約步驤名稱顯示。
- `reviewClauses` 某批 LLM 失敗：整案 FAILED（不部分成功），錯誤碼 `REVIEW_BATCH_FAILED`，訊息含批次序號。
- 無條款可切分（LLM 回空 clauses）：`loadContract` 以整段文字視為單一條款 `clauseNo="全文"` 繼續，並在 summary 註記。
- 統計寫入失敗：只記 WARN，不影響案件流程（統計是旁路）；但配額計數失敗視為不可用 → 回 503 `QUOTA_STORE_UNAVAILABLE`（避免繞過配額）。

## 7. 測試

- 後端（JUnit＋H2）：ContractReviewAgent 各 Action（stub PromptRunner）、分批合併、risk 覆寫進圖、StatusMapper 雙模式 deriveStep、Controller mode 參數與 ContractInput 正規化、`JudgmentKeywordQuery.mainText` 傳遞、`JdbcUsageEventStore` 全部方法、`StatsController` 聚合、`DailyCaseQuota` 以 DB 計數。
- 前端（node test）：state HOME／STATS／mode 轉移、hash 路由、i18n 鍵一致、renderInput 兩模式、renderProgress 兩套步驤、結果頁分頁與 CSV、風險篩選、統計頁渲染、webmcp 工具清單 22 個。
- E2E（Playwright，stub-server 加合約假資料與 stats 假資料）：首頁雙卡片 → 合約輸入 → 問答 → 結果分頁；統計頁；既有 smoke／visual 迴歸。
- 收尾驗證：`mvn test`、`npm test`、`npm run bundle`、smoke（`-c e2e/playwright.config.mjs`）；線上以 `X-LawGraph-Model: gpt-5.4-nano` 跑一件合約示範案。

## 8. 里程碑（皆可獨立上線）

1. 首頁雙入口＋路由＋合約流程「報告版」（LOAD→…→SUMMARY，結果頁 findings／summary／laws）。
2. 圖譜版（buildContractGraph）＋修訂條款（REVISE）＋WebMCP 工具。
3. 使用統計與會員資料（case_event／member 資料表、DB 配額、StatsController、統計頁、getUsageStats、個資告知與刪除、保存期限排程）。
