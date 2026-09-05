# M2 SDD 執行裁定與延後事項（自 ledger 擷取）

9:| T2 自身 | 測試用 GraphNode.withRef（現不存在）；任務文字已允許改用 14 參數建構子或新增 withRef | Ruling: 允許在 GraphNode 加 withRef(String) 便利方法（NON_NULL record，行為不變）— 若錯：多一個小方法 |
23:Task 2: Ruling: review 的 Important「clauseNo 子字串誤配（第1條 vs 第1條之1）」屬 plan 自身指定的比對規則缺陷，裁定修正為邊界感知比對＋最長 clauseNo 優先 — 若錯：多幾行比對邏輯。fix round 1 派出（base 4d2cf38）
38:Task 7: implementer DONE (commit 341d14b)；Ruling: 既有 abort 測試硬編碼工具數改為由 TOOL_NAMES_BY_VIEW 推導 — 行為等價 — 若錯：僅測試檔
42:Task 8: Ruling: 實作者修正兩個因 Task 7 新工具而漂移的既有 smoke 測試，並在 fixture 加 graph 後先點回 findings 分頁 — 皆為本任務 smoke 綠燈所需 — 若錯：僅測試檔。docker-compose 的 legal-mcp 未發佈 host port，本機改 docker run -p 8000:8000（未改 compose）。
45:Final review Ruling: Important 1–5 與 Minor 6–8 一次修；Minor 9（逐 finding 合成）、10（合成 id 去重／缺 obligation 層）、11（空圖視為 COMPLETED_WITHOUT_GRAPH）、12（AgentsDeployTest 強化）、13（main_text live 斷言）延後至 M3 收尾 — 皆非行為錯誤且 M3 會再碰這些檔案 — 若錯：M3 前這些邊界情境行為較弱。
46:Final review Ruling: getUsageStats 保留 TOOL_DEFS 但暫不放入 TOOL_NAMES_BY_VIEW（M3 接上時再加）— 避免 Agent 白呼叫必敗工具 — 若錯：M3 需記得加回。

## 延後 minor／M3 待辦
32:Task 4: minor (deferred): mapContract COMPLETED 中 notes.addAll(outcome.notes()) 仰賴前面的 null 早退
40:Task 7: minor (deferred): getComplianceReport 未完成時回 {error} 無 ok:false（沿用 getAnalysis 既有形狀）
45:Final review Ruling: Important 1–5 與 Minor 6–8 一次修；Minor 9（逐 finding 合成）、10（合成 id 去重／缺 obligation 層）、11（空圖視為 COMPLETED_WITHOUT_GRAPH）、12（AgentsDeployTest 強化）、13（main_text live 斷言）延後至 M3 收尾 — 皆非行為錯誤且 M3 會再碰這些檔案 — 若錯：M3 前這些邊界情境行為較弱。
47:Deferred-minor triage: Task 4 notes.addAll 依賴已自然解決（關閉）；Task 7 error envelope 統一 → M3 待辦。
