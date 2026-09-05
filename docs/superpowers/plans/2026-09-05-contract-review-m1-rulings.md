# M1 SDD 執行裁定與延後事項（自 ledger 擷取）

4:Ruling: 在原目錄以 feature branch 隔離而非 git worktree — 重建 node_modules/.env/Maven 快取成本高 — 若錯：main 未受污染，只是同一工作樹切換分支時需先 commit。
29:Task 2: Ruling: 實作者修改了 brief 未列的 LegalPromptsTest（第 8 條精確字串斷言）並把測試中 List.of(null) 改 Arrays.asList — 前者是加 <contract> 的必然後果，後者是 brief 測試碼瑕疵 — 若錯：只影響測試檔，無行為風險。
46:Task 11: Ruling: 實作者把 brief 測試 regex 改為符合既有屬性順序（class 在 data-step 前）— brief 的 regex 寫錯 — 若錯：僅測試檔。
47:Task 11/13: Ruling: 誤將 Task 11 fix round 與 Task 13 實作並行派出，兩者都動 frontend-tests/views.test.mjs — 收到回報後以 git log／diff 核對兩個 commit 是否互相吞入或衝突，必要時補一個修正 commit — 若錯：測試檔交錯，需人工整併。
57:Task 14: Ruling: 實作者說 RESET／續接失敗回 HOME 需重選能力 — 符合 spec §4.1「RESET 回 HOME」— 若錯：使用者多點一次卡片。
59:Task 15: Ruling: 實作者修了 app.js bindHashChange（INPUT→INPUT 模式切換）並重產 bundle，超出 brief 檔案清單 — 其 brief 指定的 smoke 測試需要此行為，且正是 Task 14 review 的 Minor④ — 若錯：與 Task 14 fix 交錯，fix 需 base 在 c836237 之上。
67:Task 16: Ruling: 本機 live 驗證改用 Muse 模型（.env 指向 Meta Muse，nano 404），且 legal-mcp sidecar 未跑 → research.laws 空、lawRefs 白名單檢查僅 vacuous 通過 — 引用過濃邏輯由 ContractReviewAgentTest 單元測試覆蓋，線上部署後需再以真實 MCP 跑一件確認 — 若錯：線上才發現 prompt 產出的 lawRefs 格式對不上 research.laws[].ref。
70:Final review Ruling: #2 採「前端警示橫幅＋findings/summary 分頁顯示 notes」而非 reviewClauses 直接失敗 — 研究軌不可用時仍讓使用者拿到帶警語的啟發式審查，與 STEP_TIMEOUT 那類「靜默重試」不同 — 若錯：使用者可能低估空法源報告的可信度（已有醒目警示緩解）。
71:Final review Ruling: #6 在 HOME 補配額列（實作，不延後）— spec §4.2 明文要求 — 若錯：多一次 /api/quota 顯示，無風險。

## 延後 minor（已於最終審查分流，未修者可等 M2）
30:Task 2: minor (deferred): SkillsConfig 類別 Javadoc 仍寫「四個技能」（第 8 行）
33:Task 4: minor (deferred): filterCitations 的 note 字串為英文（與既有 GraphRules note 一致，非規格違反）
35:Task 5: minor (deferred): CaseStatus／Result 多建構子 record 只做序列化，可加註「output-only」避免未來反序列化踩雷
37:Task 6: minor (deferred): JSON／multipart 兩處 mode 三元判斷可抽 helper；launch() 未用 CaseMode.agentName
39:Task 7: minor (deferred): en.json 合約示範 text 為中文原文，可加註說明
42:Task 9: minor (deferred): STATUS 事件 status.mode 為空字串時退回 state.mode 而非 case
44:Task 10: minor (deferred): i18n zh-TW home.case.desc／home.steps.case 用「涵攬」應為「涵攝」；「步驤」為專案既有用字（CaseService 訊息亦用），最終審查時一併決定
55:Task 13: minor (deferred): findingsCsv 以字面 BOM 字元而非 '\uFEFF'（checklistCsv 亦同）；filter aria-label 沿用 finding.risk
61:Task 15: minor (deferred): stub /api/cases/stub-c1 無 method 守衛；新 stub 分支未被網路驅動的 smoke 實際打到
66:Task 14: minor (deferred): 無 confirm 的環境離開進行中案件不會詢問
