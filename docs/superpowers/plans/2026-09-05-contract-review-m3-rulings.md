# M3 SDD 執行裁定與延後事項（自 ledger 擷取）

8:| T1 LlmUsageStats 建構子 | 現為無參數 @Component；LlmUsageStatsTest 兩處 `new LlmUsageStats()`；LlmProxyController 注入 | Ruling: 保留無參數建構子（budget 供應者為 null-safe 空 Supplier），另加 Supplier<DailyTokenBudget> 建構子＋Spring 用 @Autowired @Lazy 版 — 若錯：多一個建構子 |
11:| T3 DailyCaseQuota 建構子 | 現 `DailyCaseQuota(Clock)`；DailyCaseQuotaTest 四處；CaseController.ApiConfig bean 無參數 | Ruling: 新增 `DailyCaseQuota(Clock, UsageEventStore)`，舊建構子改為委派 InMemoryUsageEventStore（測試不必改）；ApiConfig bean 注入 UsageEventStore — WebMvcTest 切片需 @MockitoBean UsageEventStore（CaseControllerTest／DailyCaseQuotaControllerTest／CaseControllerContractTest／QuotaController 相關）— 若錯：測試切片啟動失敗，立即可見 |
15:| T6 webmcp | getUsageStats 於 M2 已從 TOOL_NAMES_BY_VIEW 移除；T6 需加回 HOME／INPUT／RESULT 並更新 README／CLAUDE.md 計數（HOME 7／INPUT 10／RESULT 12） | Ruling: 納入 T6 |
18:| M2 延後事項 | Minor 9–12（逐 finding 合成、合成 id 去重與缺 obligation 層 note、空圖→COMPLETED_WITHOUT_GRAPH、AgentsDeployTest goal 斷言）、error envelope 統一；Minor 13（main_text live 斷言）併入 T8 | Ruling: 於 T7 之後、T8 之前新增「Task 9: M2 延後事項」一次派出 |
29:Task 3: implementer DONE (commit e3b2d56，mvn 248/0/0)；Ruling: tryAcquire 改「只檢查」＋事後 recordStart 有極小競態，接受（配額是善意上限非計費）— 若錯：同身分高併發可多跑一件。QuotaController 一併改用 hash（一致性必要）。review 派出
32:Task 4: implementer DONE (commit 6ff4e2c，mvn 271/0/0)；Ruling: MemberRetentionJob 匿名化失敗仍刪會員（避免個資留存優先）— 若錯：case_event 殘留 sub，可事後補跑 anonymize。review 派出
34:Task 3/6: Ruling: Task 3 fix 以 git commit -a 把 Task 6 的前端變更一併掃進 753b347（兩者檔案不重疊，內容完整）— 不 rebase 拆分（風險大於收益）；兩個 review 都以 6ff4e2c..753b347 為範圖、各看自己的 hunks — 若錯：commit 歷史混雜，日後 bisect 較難。
41:Task 4: fix round 1 (commit 9fef8cd，mvn 277/0/0；等待 re-review)；Ruling: auth 依賴 api.AccountDeletionException 可接受（錯誤映射集中）
56:Task 8: Ruling: Zeabur 部署屬對外副作用，不在自動執行範圍 — 本任務只做文件、全套測試、本機 live（InMemory 儲存）；線上部署與 Google 登入告知驗證留待使用者決定 — 若錯：M3 的 jdbc 路徑只有 H2 測試背書，線上首次啟動才會執行 ALTER TABLE／CREATE TABLE。
62:Final review Ruling ①: 會員 identity_hash 改為 SHA-256("user:"+sub)（比 spec 更嚴，spec §5.5 同步修訂）；DELETE /api/me 只匿名化「今日以前」的列、保留今日列 → 重登同日配額不歸零且不可直接識別 — 若錯：今日列在刪帳號後仍可被持有 sub 者算出雜湊比對（弱關聯，隔日即清）。
63:Final review Ruling ⑤: recordStart 失敗改為拒絕啟動（QuotaStoreUnavailableException→503）— 與 spec §6「配額計數失敗視為不可用」一致 — 若錯：DB 抖動時使用者看到 503 而非默默放行。
64:Final review Ruling ③: sweep() 每次巡檢對未記終態的案件檢查 process 狀態並回寫 — 若錯：多一點巡檢成本。
65:Final review Ruling ④: 新增獨立 statsRateLimiter（lawgraph.stats-rate-limit-per-hour 預設 120）— 若錯：頻繁刷新統計頁的使用者可能撞 429。
66:Final review Ruling ⑬: 告知文字移除「寄信至站方信箱」（無公開信箱可寫），只保留右上角刪除帳號 — 若錯：PDPA 行使管道只剩站內功能。
67:Final review Ruling: Minor 7（TIMESTAMPTZ）、8（store 欄位）、9、10、11、14 與 Task 3 TTL map 延後為 M3.1 待辦，記入 rulings 文件。
69:Final re-review M3: all addressed. Ruling: 「legacy 原始 sub 列需 backfill」不適用 — 線上尚未部署過 M3，case_event 表不存在，無舊列；本機 InMemory 重啟即清 — 若錯：若線上曾以舊碼寫過 case_event（不可能，表由 M3 建立）。

## 延後 minor／M3.1 待辦
23:Task 1: minor (deferred): 新測試用 Clock.systemUTC() 而非 Taipei 慣例
27:Task 2: minor (deferred): countToday 用 Integer.class 依賴 Spring 轉換；InMemory recordStart 語意註解可更明確
31:Task 3: review Approved but Important①recordStart 晚於非同步啟動 → fix round 1 派出（recordStart 移入 CaseService.launch，platform.start 之前）；minor (deferred): CaseService 三個無上限 map（finished/locales/modes）需 TTL
45:Task 7: Important「後端 notice-ack 是否同步」— 控制端確認 MeController.acknowledgeNotice 同步寫入後回 204（Task 4 diff）→ 非缺口；minor (deferred): onDelete alert 可能顯示 undefined
58:Task 9: minor (deferred): 合成 note 的 N 為全部 findings 數（含空 clauseNo）

## 最終審查延後（M3.1）
- TIMESTAMP→TIMESTAMPTZ（PG）；/api/stats 回應移除 store 欄位；dailyStats 拋錯 500 無測試；CaseStartContext 改必要參數；getUsageStats 成功回傳加 ok；相容建構子 new InMemory 黑洞；CaseService 三個 map（finished/locales/modes）TTL；QuotaStoreUnavailableException 訊息雙語；刪帳號失敗 alert 專用 i18n 鍵；F5 建立未啟動的 AgentProcess 殘留於 Embabel repository
