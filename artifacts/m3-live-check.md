# M3 本機 Live 驗證（2026-09-05）

環境：本機 :8080，InMemory 退回（未設 `LAWGRAPH_DB_URL`），`LAWGRAPH_DAILY_CASES_PER_USER=0`，
`LAWGRAPH_TEST_MODEL=muse-spark-1.3-contributor`，header `X-LawGraph-Model: muse-spark-1.3-contributor`。
legal-mcp 容器（law-graph-webmcp-legal-mcp-1）已在 :8000 運行（healthy）。

## (a) GET /api/stats?days=3（跑案前）

`store="memory"`，回傳 3 天（2026-09-03～09-05），`today.total=0`，`today.promptTokens=0`（記憶體
儲存乾淨啟動，跑案前無事件）。

## (b) 跑一件合約案（labor-contract, partyB, scopes=[labor], documents=[revised]）

- 第一次腳本呼叫（`caseId=ecstatic_burnell`）因腳本誤讀 `result.brainstorm.questions`（實際問題在
  回應頂層 `questions` 欄位）送出空 answers 陣列被 API 拒絕（400），該案件留在 `WAITING` 未再繼續，
  但已建立一筆 `case_event`（RUNNING/未完成）。
- 修正腳本後重新跑一案（`caseId=zen_nightingale`）：LOAD → WAITING/QUESTIONS（回答 q1/q2/q3
  皆填「不清楚」）→ RESEARCH → REVIEW → SUMMARY → REVISE → GRAPH → **COMPLETED**，全程約 3 分 47 秒。
- 結果存於 `artifacts/m3-live-contract.json`。

## (c) GET /api/stats?days=3（跑案後）

```
today.total: 0 → 2   （含上述兩次呼叫：一次中止於 WAITING、一次 COMPLETED）
byMode.contract: 0 → 2
completed: 0 → 1      （只有 zen_nightingale 進到 COMPLETED）
promptTokens: 0 → 119274
completionTokens: 0 → 30620
totalTokens: 0 → 149894
```

`total` 的增量為 **+2** 而非預期的 +1，原因是第一次腳本呼叫的失敗（我方腳本問題，非後端 bug）也
建立了一筆 case_event；`completed` 正確反映只有一件真的跑到 COMPLETED（+1）。tokens 如預期增加。

## (d) GET /api/quota

```json
{"date":"2026-09-05","used":2,"limit":0,"remaining":-1,"exhausted":false,"loggedIn":false,"memberLimit":5,"loginPath":"/oauth2/authorization/google"}
```

`used=2` 與 `case_event` 計數一致（`LAWGRAPH_DAILY_CASES_PER_USER=0` 代表不限制，故 `remaining=-1`
為預期行為，非 bug）。

## (e) M2 遺留檢查

- `result.research.laws` 在最終案件 JSON（`zen_nightingale`）非空：共 **15 筆**法規引用，
  legal-mcp 服務正常運行時該欄位確實有內容。
- `main_text`（判決查詢是否帶勝方過濾）：`grep -c main_text artifacts/m3-live-server.log` 結果為
  **0**——本次案件的 RESEARCH 步驟命中的是法規（laws）而非判決檢索路徑，或該欄位輸出在 DEBUG
  層級（目前 application.yml 未設 DEBUG，未依指示更動已提交的 log 層級設定），因此**本次無法確認
  main_text 是否曾被帶入判決查詢**。如需驗證，需要另外在不提交的本機設定下臨時調高
  `tw.lawgraph.research` 或 MCP adapter 的 log level 為 DEBUG 後重跑一次帶判決查詢的案件。

## Google 登入

本機沒有設定 `GOOGLE_CLIENT_ID` / `CLIENT_ID`（`.env` 雖有 `CLIENT_ID` 但本次未設為環境變數注入
Spring；且即便設定，OAuth callback 需要瀏覽器互動與已註冊的 redirect URI），**本次無法在本機以
自動化腳本測試 Google 登入、首登告知卡與 `DELETE /api/me` 對 `member.total` 的影響**；這部分需人工
以瀏覽器登入才能驗證，明確聲明未執行。

## 結論

- 統計端點、配額計數、合約案件全流程（含問答、法規檢索、REVISE、GRAPH）在 InMemory 退回下運作正常。
- `case_event` 計數與 `/api/stats`／`/api/quota` 數字一致。
- 唯一保留項：main_text 判決查詢過濾證據未能在本次以現有 log 層級確認；Google 登入相關驗證需人工執行。
