# law-graph-webmcp 雙 MCP 法律研究聚合規格

日期：2026-09-03

狀態：Draft，待開發者確認

Owner：law-graph-webmcp

依據：`2026-08-30-law-graph-webmcp-design.md`、現行 Embabel 1.5.1／Spring AI 2.0.0 程式、TW Legal RAG 官方安裝說明

## 1. 三行摘要

- **做什麼**：在既有 `taiwan-legal-db` 關鍵字／法規 MCP 之外，加入 `tw-legal-rag` 語意 MCP，先由程式並行檢索、正規化、JID 去重與排序，再將單一研究證據集合交給 AI 涵攝分析。
- **給誰**：使用 law-graph-webmcp 分析台灣法律爭議的訪客，以及維護 Zeabur 部署與法律檢索品質的開發者。
- **為何現在做**：現行網站只用關鍵字搜尋，對口語案情或同義法律爭點召回率不足；若直接把兩組工具都交給 LLM，又無法保證每次雙查、去重一致或故障降級。

> 內部需求：「加入雙 MCP 內容，合併去重後一起給 AI 分析。」

## 2. 背景與問題

現行 `LegalGraphAgent.research()` 由一次 LLM tool loop 呼叫 `taiwan-legal-db`，輸出 `ResearchResult`；`analyze()` 又可使用相同工具群組。此設計有四個缺口：

1. `LegalPrompts.system()` 與 `research()` 明確停用語意 MCP，只能走 `search_judgments` 關鍵字單軌。
2. `ToolGroupsConfig` 將所有 `McpSyncClient` 放入同一 ToolGroup，僅以裸工具名稱過濾；加入第二個 MCP 後，不能依賴 client 清單順序或只靠同名工具判斷來源。
3. `ResearchResult`／`JudgmentRef` 沒有雙軌來源、引用白名單、全文驗證與 coverage 狀態，AI 看不出證據來自哪一軌。
4. 若只改成 `.withToolGroups(LEGAL_DB, TW_LEGAL_RAG)`，只能表示「模型看得到兩組工具」，不能保證模型一定呼叫兩邊、並行完成，或以固定規則去重。

本規格因此將檢索拆成「LLM 規劃」與「程式執行／合併」兩層。AI 不直接合併兩份原始 MCP transcript，而是只讀取已通過程式規則的統一研究結果。

## 3. 目標與非目標

### 3.1 目標

- 對「找相關判決／論理」類查詢，同一案件同時執行：
  - `taiwan-legal-db:search_judgments` 關鍵字軌。
  - `tw-legal-rag` 語意軌；工具名稱與輸入 schema 以完成 OAuth 後的 `tools/list` 為準，預期主要入口為 `search_bundle`。
- 法規條文仍由 `taiwan-legal-db` 查詢與驗證，避免同一法條產生多個來源版本。
- 將兩軌結果正規化，以 `semantic.doc_id == keyword.jid` 為主要去重鍵。
- 雙軌命中、全文完整度、語意分數與關鍵字排名使用確定性規則排序。
- 合併後才限制筆數／字數，將單一 `ResearchResult` 傳入 `analyze()`。
- 語意 MCP 未授權、逾時或失敗時，自動降級為關鍵字單軌；不得拖垮整個 app。
- 保留現有 REST 與前端主要契約；既有案件仍可在沒有語意 MCP 時完成。
- 所有可引用法條、判決都必須存在於合併後的研究白名單。

### 3.2 非目標

- 不讓 AI 直接自由瀏覽網頁補判決。
- 不以關閉 TLS 驗證、硬編 token 或帶 token 的一般 HTTP 呼叫繞過 MCP OAuth。
- 不建立一般使用者帳號、付費、案件歷史或完整 OAuth 帳號管理系統。
- 不把 TW Legal RAG 轉售、鏡像或包裝成另一個公開 MCP 服務。
- 不在本功能重做前端 3D 圖、WebMCP 工具或書狀 UI。
- 不保證兩個同步 MCP request 在作業系統層完全同時開始；要求是由受控 executor 並行排程，並以獨立 timeout 收斂結果。

## 4. 成功指標

| 指標 | 目標 | 測量方式 |
|---|---:|---|
| 雙軌啟用率 | 語意 MCP 可用時，相關判決查詢 100% 排程兩軌 | orchestrator 單元測試＋結構化執行紀錄 |
| JID 去重正確率 | fixture 中相同 `doc_id/jid` 100% 只輸出一筆 | `JudgmentMergeServiceTest` |
| 引用白名單一致性 | 分析、書狀與圖中的判決 JID 100% 存在於 merged research | Agent／GraphRules 測試 |
| 降級可用性 | 語意軌 401、timeout、5xx 時案件仍走完關鍵字流程 | orchestrator 故障測試 |
| 法規防幻覺 | legal-mcp 查無或失敗時不產生未驗證法條 | prompt／domain rule 測試 |
| 合併確定性 | 同一組輸入不因回傳順序不同而改變輸出順序 | permutation 單元測試 |
| 敏感資料保護 | log、REST response、repo 均不含 OAuth token | log assertion＋部署檢查 |

## 5. 使用情境

- 作為訪客，我希望用口語描述法律爭點也能找到同義但不同關鍵字的相關判決，以免只得到少量或偏離的結果。
- 作為訪客，我希望同一判決不會在研究頁出現兩次，也不會因兩個來源摘要不同而讓 AI 重複計權。
- 作為訪客，我希望語意服務暫時不可用時仍能完成分析，並清楚知道本次是單軌結果。
- 作為開發者，我希望檢索、正規化、合併與 AI 分析彼此分離，能用 fake port 在沒有外部 MCP／LLM 時完成大部分測試。
- 作為維運者，我希望能看到每軌延遲、候選數、去重數與故障類型，但看不到案件全文或 OAuth token。

## 6. 目標架構

```text
CaseInput + BrainstormResult + UserAnswers
                    │
                    ▼
       planResearch（LLM，無 MCP 工具）
                    │ ResearchPlan
                    ▼
          DualMcpResearchService
          ┌─────────┴─────────┐
          ▼                   ▼
 TaiwanLegalDbPort       TwLegalRagPort
 法規＋關鍵字判決          語意判決 bundle
          │                   │
          └─────────┬─────────┘
                    ▼
       JudgmentMergeService（純 Java）
       normalize → trust gate → dedupe → rank → cap
                    │
                    ▼
             ResearchResult
                    │
                    ▼
       analyze（LLM，只讀 merged evidence）
                    │
          DraftedDocuments / GraphRules
```

### 6.1 Embabel Action 鏈變更

現行：

```text
... → research(LLM + MCP) → ResearchResult → analyze(LLM + MCP) → ...
```

目標：

```text
... → planResearch(LLM) → ResearchPlan
    → research(純 Java orchestration) → ResearchResult
    → analyze(LLM，預設不開搜尋工具) → ...
```

- `planResearch` 只把案情、brainstorm、answers 轉成固定 schema 的檢索計畫。
- `research` 由 `DualMcpResearchService` 執行，不讓 LLM 決定是否略過某一軌。
- `analyze` 只使用合併後資料。若未來確實需要補全文，只能開放 verification-only ToolGroup，例如 `get_judgment`／`query_regulation`，不得開放新的搜尋工具。

### 6.2 元件責任

| 元件 | 責任 |
|---|---|
| `ResearchPlan` | 保存法規查詢、關鍵字判決查詢與語意案情描述；不得含 MCP response |
| `TaiwanLegalDbPort` | 封裝 `query_regulation`、`search_judgments`、必要的 `get_judgment` |
| `TwLegalRagPort` | 封裝完成 OAuth 後確認的語意工具 schema；不得把 OAuth token傳入 domain 層 |
| `McpClientRegistry` | 依 server identity／設定名稱辨識 client；禁止依賴 `List<McpSyncClient>` 順序 |
| `DualMcpResearchService` | 受控並行、timeout、重試與降級；整合 laws 與 judgment candidates |
| `JudgmentMergeService` | 純函式正規化、trust gate、去重、欄位選擇、排序與上限 |
| `LegalGraphAgent` | 以型別串接 plan、research、analyze、draft、graph |

## 7. MCP 連線與授權

### 7.1 連線設定

Spring AI Streamable HTTP 以 `url + endpoint` 組成最終網址。目標設定：

```yaml
spring:
  ai:
    mcp:
      client:
        type: SYNC
        request-timeout: 60s
        streamable-http:
          connections:
            legal-mcp:
              url: ${LEGAL_MCP_URL:http://localhost:8000}
            tw-legal-rag:
              url: ${TW_LEGAL_RAG_URL:https://tlr.dr-legal.com.tw}
              endpoint: /mcp
```

不得同時把 `url` 設為 `https://tlr.dr-legal.com.tw/mcp` 又保留 `/mcp` endpoint，以免組成 `/mcp/mcp`。

### 7.2 OAuth 與部署閘門

TW Legal RAG 官方說明為動態 OAuth、免帳號與免 API key，但首次連線仍由支援 remote MCP 的 client 完成授權。Zeabur 為 headless Spring Boot runtime，必須先通過以下閘門：

1. 在與 production 相同的 Spring AI 2.0.0 client 上，確認 OAuth discovery、dynamic registration、callback 與 refresh lifecycle 的實際行為。
2. token 只存 Zeabur secret、受保護持久儲存或正式 security component；不得寫進 Git、一般 env dump、log 或 REST response。
3. container 重啟後必須能 refresh 或重新授權；不能只靠本機 IDE 已存在的 token。
4. 語意 client 初始化失敗不得讓 `legal-mcp` 與網站一起啟動失敗。
5. 公開試驗網站使用前，確認 TW Legal RAG 服務條款允許此對外網站的使用方式；未確認前只做本機／受控測試。

### 7.3 工具探索閘門

完成 OAuth 後先保存不含敏感值的 `tools/list` 測試 fixture，確認：

- server identity。
- 語意搜尋實際工具名稱。
- 輸入 schema、結果中的 `doc_id`、引用白名單、全文／摘要欄位。
- 錯誤 payload 與 timeout 行為。

在 schema 未確認前，不把推測參數硬編進 production adapter。

## 8. 資料契約

### 8.1 ResearchPlan

```text
ResearchPlan {
  regulationQueries[]      // 法規名稱、條號或查詢詞
  judgmentKeywordQueries[] // keyword、caseType、必要的法院／日期條件
  semanticCaseText         // 保留爭點、事實與使用者回答的完整語意描述
}
```

限制：

- 查詢字串須從 `CaseInput`、`BrainstormResult`、`UserAnswers` 產生。
- 不得由 plan 階段聲稱已找到法條或判決。
- 空白查詢在進入 adapter 前剔除；同軌重複查詢先去重。

### 8.2 內部候選格式

```text
JudgmentCandidate {
  rawId
  canonicalJid
  citation
  court
  date
  summary
  fullText
  url
  sources[]           // KEYWORD, SEMANTIC
  keywordRank?
  semanticScore?
  citationId?
  citationAllowed
  fullTextVerified
}
```

`JudgmentCandidate` 僅存在 research package，不直接回傳前端。

### 8.3 合併後 ResearchResult

既有 `laws`、`judgments`、`notes` 保留。`judgments` 的元素需補足可供 AI 與 UI 判斷的 provenance，建議採 wrapper 以降低既有 `JudgmentRef` 破壞面：

```text
JudgmentEvidence {
  judgment: JudgmentRef
  sources[]             // KEYWORD, SEMANTIC
  citationId?
  fullTextVerified
}

ResearchCoverage {
  keywordStatus         // SUCCESS, PARTIAL, FAILED
  semanticStatus        // SUCCESS, UNAVAILABLE, PARTIAL, FAILED
  keywordCandidateCount
  semanticCandidateCount
  mergedCount
}

ResearchResult {
  laws[]
  judgments[]           // JudgmentEvidence
  notes[]
  coverage
}
```

若為避免一次修改前端而暫時保留 `List<JudgmentRef>`，第一階段可將 provenance 存在額外 `evidence[]`；不得只把所有資訊塞進無結構的 `notes`。

## 9. 合併與去重規則

### 9.1 canonical JID

1. 保留 `rawId` 原值供追蹤與引用。
2. `canonicalJid` 僅作比較：trim、Unicode NFKC、統一可安全辨識的 ASCII 大小寫與分隔符空白。
3. 不改寫中文字號內容，不以 citation 顯示文字代替 JID。
4. 缺少可驗證 JID／doc_id 的候選不得進入可引用清單；寫入 notes 與 dropped metric。

### 9.2 duplicate merge

相同 `canonicalJid`：

- `sources` 取聯集，雙軌命中標記為 true。
- `rawId` 均保留於內部 trace；輸出 JID 使用已驗證且非空值。
- `citation`、court、date 優先採合法且較完整值；欄位衝突不得靜默覆蓋，需記錄 warning。
- summary／fullText 只在引用白名單或來源驗證通過時採用；優先保留已確認的完整理由內容。
- URL 只接受 HTTPS 與允許來源；非法 URL 清空，不影響該判決的 JID 白名單資格。

### 9.3 排序

排序必須穩定且不依賴 future 完成順序：

1. 雙軌命中優先。
2. `fullTextVerified=true` 優先。
3. 有效 semantic score 由高到低。
4. keyword rank 由小到大。
5. `canonicalJid` 作穩定 tie-breaker。

排序後才套用 `lawgraph.research.max-judgments`；被截斷筆數寫入 coverage，不把兩份原始 response 全量送進 LLM context。

## 10. 失敗與降級

| 情況 | 行為 |
|---|---|
| semantic 401／尚未授權 | `semanticStatus=UNAVAILABLE`；關鍵字單軌續行；notes 一次性說明語意檢索未啟用 |
| semantic timeout／5xx | `semanticStatus=FAILED`；關鍵字單軌續行；記錄類型與耗時，不記 token／response body |
| keyword judgment 失敗、semantic 成功 | 保留經引用白名單驗證的 semantic judgments；`keywordStatus=FAILED` |
| legal-mcp 法規失敗 | laws 留空或只保留成功驗證項；AI 不得補寫未驗證法條；標記 research incomplete |
| 單一候選解析失敗 | 丟棄該候選並增加 dropped count；其他候選續行 |
| 兩軌判決皆失敗 | judgments 為空，analysis 明示證據不足；不得憑模型記憶補判決 |
| executor／程式錯誤 | process 進 `FAILED`，錯誤碼不含案件全文或憑證 |

預設 timeout 必須可設定；初始建議 keyword 60 秒、semantic 30 秒、整體 65 秒。正式值以 live latency artifact 校準。

## 11. AI 分析契約

`LegalPrompts.analyze()` 必須：

- 將完整 merged `ResearchResult` 以單一 `<research>` 區塊傳入。
- 僅能引用 `research.laws[].ref` 與 `research.judgments[].judgment.jid/citation`。
- 能看見 `sources` 與 `coverage`，在 semantic unavailable／partial 時降低結論確定性。
- 不可把 MCP 錯誤文字當法律內容。
- 不可重新搜尋新的判決；若開 verification-only 工具，也只能補齊已在白名單的 ref/JID。

`GraphRules` 必須改為從 `JudgmentEvidence.judgment.jid` 建立白名單，其他硬規則不變。

## 12. 可觀測性與安全

每次 research 產生同一個 correlation ID，記錄：

- keyword／semantic elapsed time。
- 各軌候選數、dropped 數、merged 數、dual-hit 數。
- status 與錯誤分類：AUTH、TIMEOUT、UPSTREAM、PARSE、INTERNAL。
- 是否啟用 fallback。

不得記錄：

- OAuth token、authorization code、callback query。
- 完整案件內容、完整判決全文。
- MCP 原始 response body。

TLS 驗證保持開啟；沿用 Debian bookworm／CA trust chain 修正，不新增 insecure toggle。

## 13. 範圍與里程碑

| 階段 | 交付 |
|---|---|
| M0：契約閘門 | OAuth/headless 行為、`tools/list` schema、服務條款與 public demo 使用方式確認 |
| M1：純 domain | ResearchPlan、candidate、canonical JID、merge／rank／coverage，全部純單元測試 |
| M2：雙 MCP orchestration | 兩個 port／adapter、client registry、並行 timeout、fallback、假 MCP 整合測試 |
| M3：Agent 串接 | Action chain、prompt、GraphRules、StatusMapper／前端相容性測試 |
| M4：部署驗收 | Zeabur secret／OAuth、live 雙軌 case、raw artifact、README 與操作說明 |

## 14. 驗收條件

- [ ] `application.yml` 有兩個具名 Streamable HTTP connection，TW Legal RAG 最終 URL 正確為 `/mcp`。
- [ ] OAuth 未完成時 app 仍可啟動，`legal-mcp` 關鍵字流程可用。
- [ ] 一個一般相關判決查詢可證明兩軌都被排程；log 只有 metadata。
- [ ] 相同 `doc_id/jid` 最終只有一筆，且 `sources=[KEYWORD, SEMANTIC]`。
- [ ] future 回傳順序相反時，merged JSON 仍相同。
- [ ] semantic 401／timeout／5xx 測試均能完成 keyword-only research。
- [ ] 任何分析／書狀／圖節點引用的 JID 均存在於 merged research。
- [ ] `analyze()` 不得新增未經 merge 的搜尋結果。
- [ ] 既有 REST client 與前端測試通過；無語意 MCP 時行為向後相容。
- [ ] Zeabur live artifact 顯示雙軌候選數、去重數與完成結果，且不暴露 token。

## 15. 未決策項目

| 問題 | Owner | 必須在何時決定 |
|---|---|---|
| Spring AI 2.0.0 在 headless Zeabur 如何完成 dynamic OAuth、callback 與 refresh？ | Backend | M0 結束前 |
| TW Legal RAG 的 production `tools/list` 名稱與 schema 是否仍為 `search_bundle`？ | Backend | M0 結束前 |
| 公開試驗網站是否符合 TW Legal RAG 對外服務使用條款？ | Product／Owner | 部署 semantic 前 |
| 每案最多送入 AI 幾筆判決與多少全文字數？ | Product／Backend | M1 結束前；先以 10 筆作測試預設 |
| 是否在 Research 分頁顯示來源徽章與 coverage？ | Product／Frontend | M3 前；後端先提供欄位 |
| keyword failure 但 semantic success 時，是否允許完成書狀草稿？ | Product／Legal reviewer | M3 前；預設允許但標記 partial |

## 16. 參考資料

- 現行設計：`docs/superpowers/specs/2026-08-30-law-graph-webmcp-design.md`
- TW Legal RAG MCP：<https://dr-legal.com.tw/mcp>
- Spring AI MCP Client：<https://docs.spring.io/spring-ai/reference/api/mcp/mcp-client-boot-starter-docs.html>
- Spring AI MCP Security：<https://docs.spring.io/spring-ai/reference/api/mcp/mcp-security.html>
