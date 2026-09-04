# law-graph-webmcp 分析流程專業化規格（抗辯評估與舉證責任）

日期：2026-09-05

狀態：Draft，待開發者確認

Owner：law-graph-webmcp

依據：`2026-08-30-law-graph-webmcp-design.md`、`2026-09-03-dual-mcp-research-design.md`、現行 `LegalGraphAgent`（Embabel 1.5.1 GOAP）、law-powers 技能包 `legal-element-analysis` 步驟零至四

## 1. 三行摘要

- **做什麼**：把現行六步流程補成法律人熟悉的完整分析路徑：在「逐要件涵攝」之後新增「抗辯評估與舉證責任」步驤，並把進度條與結果頁的用語改成訴訟實務用語；涵攝表加上每個請求權基礎的小結。
- **給誰**：以本站分析台灣民事／刑事爭議的法律人與一般使用者；維護 Agent 流程的開發者。
- **為何現在做**：現行流程已涵蓋事實整理、爭點、請求權基礎檢索、涵攝、書狀，但「對造會怎麼反駁」與「誰要證明什麼、手上有沒有證據」兩件律師必做的事散落在策略段與證據缺口清單裡，沒有自己的步驤與結構化輸出，法律人一看就覺得少了一段。

## 2. 現況對照與缺口

| 現行步驤 | 法律方法 | 評價 |
|---|---|---|
| BRAINSTORM 整理事實與爭點 | 事實整理、爭點整理（民訴 §270-1）、IRAC 的 Issue | 標準做法 |
| QUESTIONS 等待你的回答 | 律師諮詢時的事實補充追問（最多三輪） | 標準做法 |
| RESEARCH 檢索法條與判決 | 請求權基礎思考法、實務見解檢索 | 標準做法，用語可更專業 |
| ANALYSIS 逐要件涵攝 | 三段論法涵攝（Subsumtion） | 標準做法 |
| DOCUMENTS 起草書狀 | 書狀撰寫 | 標準做法 |
| GRAPH 建立關係圖 | 法律關係圖 | 輔助工具 |

缺口：

1. **對造抗辯與風險評估**沒有獨立產出。`AnalysisResult.strategy` 是一段自由文字，無法逐爭點看「對方會怎麼說、我方怎麼回、風險多高」。
2. **證據與舉證責任**只有 `evidenceGaps` 字串清單，沒有「待證事實 → 舉證責任方（民訴 §277）→ 現有證據 → 缺口 → 取得方式」的結構。
3. **請求權小結**缺席：涵攝表逐要件列出該當與否，但沒有回答「這條請求權成立嗎」。
4. 進度條與分頁用語偏白話（「頭腦風暴」「檢索法條與判決」），法律人第一眼的專業感不足。

## 3. 目標與非目標

### 目標

- G1：新增 Action `assessCase`，在 `analyze` 之後、`draftDocuments` 之前，輸出結構化 `CaseAssessment`（對造抗辯評估、舉證責任與證據計畫、風險摘要）。
- G2：進度條加入第 5 步 `ASSESSMENT`，共七步；所有步驤標籤改為訴訟實務用語（中英）。
- G3：結果頁「分析」分頁重排為：涵攝表（含各請求權基礎小結）→ 對造抗辯與回應 → 證據與舉證責任 → 策略與風險。
- G4：書狀起草可讀到 `CaseAssessment`，答辯狀／準備書狀能針對對造抗辯預作回應。
- G5：`CaseStatus` REST 契約向後相容：新增欄位，不改既有欄位。
- G7：**語氣分層**：對使用者的詢問（追問問題）、進度與區塊標題、清單說明一律白話，並在括號內附專業名詞；分析結果、涵攝依據、抗辯回應、書狀等輸出維持專業法律用語。
- G6：產出一份可獨立交付的**當事人準備清單**：證據缺口、需準備的文件、人證、程序事項與期限、費用，分類列出並可匯出 CSV／列印，與書狀分開呈現在獨立分頁。

### 非目標

- 不改變檢索（雙 MCP）與 GraphRules 的行為。
- 不新增第二個 LLM 供應商或改變模型選擇。
- 不做案件狀態持久化（重佈仍會清空進行中的案件）。
- 不在圖上新增證據／抗辯節點（GraphRules 白名單維持現狀）。

## 4. 設計

### 4.1 領域模型（`tw.lawgraph.domain`）

```java
/** 對造可能提出的抗辯、我方回應與風險評級（每個爭點一至數列）。 */
public record DefenseAssessment(String issue, String defense, String response, Risk risk) {}

/** 風險三級。 */
public enum Risk { high, medium, low }

/** 舉證責任與證據計畫：待證事實、依民訴 §277 由誰舉證、現有證據、缺口、取得方式。 */
public record EvidenceItem(String fact, String burden, String available, String missing, String howToObtain) {}

/** 當事人準備清單一列：分類、項目、為何需要、時限提示。 */
public record ChecklistItem(String category, String item, String why, String dueHint) {}

/** assessCase Action 的產物。 */
public record CaseAssessment(List<DefenseAssessment> defenses, List<EvidenceItem> evidencePlan,
                             List<ChecklistItem> checklist, String riskSummary) {
    public CaseAssessment { defenses = safe(defenses); evidencePlan = safe(evidencePlan); checklist = safe(checklist); riskSummary = riskSummary == null ? "" : riskSummary; }
}
```

`category` 固定五類：`證據文件`／`人證`／`程序事項`／`費用與期限`／`其他`。清單由同一次 `assessCase` 呼叫產生：合併 `evidencePlan.missing`、`analysis.evidenceGaps`、`brainstorm.evidenceNeeds`，再補程序事項（委任狀、起訴或上訴期間、裁判費概算、管轄法院與當事人資料）。

`burden` 使用固定字串 `原告`／`被告`／`檢察官`／`不明`（英文語系 `plaintiff`／`defendant`／`prosecutor`／`unclear`），由 prompt 規定，前端只顯示不判斷。

### 4.2 Agent 流程（GOAP 型別鏈）

```
CaseInput → brainstorm → BrainstormResult → askUser … → ClarifiedAnswers
→ planResearch → ResearchPlan → prepareSemanticQuery → SemanticQuery → research → ResearchResult
→ analyze → AnalysisResult
→ assessCase(CaseInput, BrainstormResult, ResearchResult, AnalysisResult, ClarifiedAnswers) → CaseAssessment   ← 新增
→ draftDocuments(…, AnalysisResult, CaseAssessment) → DraftedDocuments                                    ← 多一個參數
→ buildGraph(…, DraftedDocuments) → GraphOutcome
```

- `assessCase` 一次 LLM 呼叫，`withReference(skills)`，system prompt 同其他步驤，輸出 `CaseAssessment`；經 `TaiwanTerminology.sanitize(CaseAssessment)` 用語守門。
- 引用白名單同 `analyze`：只能引用 `research.laws / judgments / evidence`；`coverage.semanticStatus != SUCCESS` 時降低確定性。
- `draftDocuments` 增加 `CaseAssessment` 參數以確保順序，prompt 多一段 `<assessment>`，規則加一條：「答辯狀、準備書狀須就 assessment.defenses 逐項回應；起訴狀就 high 風險抗辯預作說明」。
- `buildGraph` 不變（參數已含 `DraftedDocuments`，順序自然在 assess 之後）。

### 4.3 步驤與狀態

- `StatusMapper.deriveStep`：`documents != null → GRAPH`；`assessment != null → DOCUMENTS`；`analysis != null → ASSESSMENT`；`research != null → ANALYSIS`；`answers != null → RESEARCH`；`brainstorm != null → QUESTIONS`；否則 `BRAINSTORM`。
- `StatusSnapshot` 與 `CaseStatus.Result` 各加 `CaseAssessment assessment`（`@JsonInclude(NON_NULL)`，未產生時省略，舊前端不受影響）。
- 前端 `STEPS = ['BRAINSTORM','QUESTIONS','RESEARCH','ANALYSIS','ASSESSMENT','DOCUMENTS','GRAPH']`。

### 4.4 用語（i18n）

白話為主、括號附專業名詞；英文版直接用術語。

| key | zh-TW | en |
|---|---|---|
| progress.BRAINSTORM | 整理案情與爭執點（事實與爭點整理） | Facts & issues |
| progress.QUESTIONS | 補充案情（等待你的回答） | Clarifying questions |
| progress.RESEARCH | 找法條與判決（請求權基礎與實務見解檢索） | Legal basis & case-law research |
| progress.ANALYSIS | 逐條檢查是否符合法律要件（構成要件涵攝） | Element subsumption |
| progress.ASSESSMENT | 對方會怎麼反駁、誰要負責證明（抗辯評估與舉證責任） | Defenses & burden of proof |
| progress.DOCUMENTS | 撰寫法院文件（書狀起草） | Drafting documents |
| progress.GRAPH | 畫出法律關係圖 | Relationship graph |
| result.tab.brainstorm | 案情與爭執點 | Facts & issues |
| result.tab.research | 法條與判決 | Research |
| result.tab.analysis | 法律分析（涵攝與評估） | Analysis |
| result.tab.checklist | 你需要準備的東西 | Client checklist |
| result.elements | 逐條檢查法律要件（構成要件涵攝表） | Elements |
| result.defenses | 對方可能怎麼反駁、我們怎麼回應（抗辯評估） | Likely defenses & responses |
| result.evidencePlan | 誰要證明什麼、還缺哪些證據（舉證責任與證據計畫） | Evidence & burden of proof |
| result.risk | 整體風險 | Risk summary |
| result.claimSummary | 各項請求能不能成立（請求權基礎小結） | Claim summary |
| claim.established / claim.failed / claim.pending | 要件齊備 / 有要件不該當 / 待補證據 | All elements met / An element fails / Evidence needed |
| evidence.fact / burden / available / missing / howToObtain | 待證事實 / 舉證責任 / 現有證據 / 缺口 / 取得方式 | Fact to prove / Burden / Available / Missing / How to obtain |
| defense.issue / defense / response / risk | 爭點 / 對造抗辯 / 我方回應 / 風險 | Issue / Defense / Response / Risk |
| risk.high / medium / low | 高 / 中 / 低 | High / Medium / Low |

### 4.5 結果頁「涵攝與評估」分頁

1. **構成要件涵攝表**：沿用 `elementsList`，之後以 `law` 分組加一行小結：全部 `yes` → 要件齊備；任一 `no` → 有要件不該當；其餘 → 待補證據。純前端計算，不多花 LLM。
2. **對造可能抗辯與回應**：表格四欄（爭點、對造抗辯、我方回應、風險徽章 high/medium/low 三色）。
3. **證據與舉證責任**：表格五欄（待證事實、舉證責任、現有證據、缺口、取得方式）。
4. **策略與風險**：`analysis.strategy` 與 `assessment.riskSummary`，其後保留 `analysis.evidenceGaps`（法源不足時的補充）。

進行中頁面的「目前成果」在 `assessment` 出現後同樣渲染 2、3 兩表。

### 4.6 當事人準備清單分頁

- 結果頁新增分頁 `checklist`（標籤「當事人準備清單」／「Client checklist」），排在書狀分頁之後、輔助分頁之前；進行中「目前成果」不顯示（清單需完整才有意義）。
- 內容：依五個分類分組的表格（項目、為何需要、時限提示），頂端一行說明「以下為本案建議準備事項，請於下次會面或提出書狀前備妥」。
- 匯出：沿用爭點整理表的 CSV 匯出模式，檔名「當事人準備清單.csv」；另提供「列印」按鈕呼叫 `window.print()`，CSS `@media print` 只印該分頁。
- WebMCP：`getCaseStatus` 已回傳完整 result，清單隨 `result.assessment.checklist` 一併給 Agent，不另加工具。

### 4.7 語氣分層（白話詢問、專業輸出）

- **白話層**（面向當事人）：`brainstorm.questions[].text`／`why`、二三輪追問、進度條與分頁標籤、區塊標題、準備清單的 `item`／`why`／`dueHint`、清單說明句。規則：短句、不用文言連接詞（按／查／爰）、第一次出現的法律名詞後用括號附專業名詞，例如「對方主張你太晚提告（消滅時效抗辯）」。
- **專業層**（面向法律人與法院）：`AnalysisResult.elements[].basis`／`fact`、`strategy`、`DefenseAssessment.defense`／`response`、`EvidenceItem` 各欄、`riskSummary`、所有書狀。維持現行「台灣律師涵攝寫法」與書狀正式語體。
- 實作位置：`LegalPrompts.system()` 加一條規則明示兩層；`brainstorm`／`clarify` prompt 對 questions 加白話要求；`assess` prompt 對 checklist 加白話要求、對 defenses／evidencePlan／riskSummary 加專業要求；i18n 標籤依上表。

### 4.8 Prompt（`LegalPrompts.assess`）

要求：以 `legal-element-analysis` 步驟四「結論與證據缺口」為基礎延伸；每個 `brainstorm.issues` 至少一列 defenses；evidencePlan 逐一對應 `analysis.elements` 中 `met=unknown` 或 `no` 的要件所需事實；`burden` 用固定字串；checklist 以五個固定分類彙整 evidencePlan.missing、analysis.evidenceGaps、brainstorm.evidenceNeeds 並補程序事項，每列附「為何需要」與時限提示，不重複；只能引用 research 白名單；台灣用語；輸出 JSON 物件。

## 5. 驗證

- 單元測試：`LegalPromptsTest.assessPrompt…`、`LegalGraphAgentTest.assessCaseUsesSkillAndSanitizes`、`TaiwanTerminologyTest`（新 overload）、`StatusMapperTest`（ASSESSMENT／DOCUMENTS 步驤推導與 result.assessment 輸出）、前端 `views.test.mjs`（七步進度條、涵攝與評估分頁四區塊、小結判斷）。
- 全套 `mvn -B package` 綠燈、`npm test` 綠燈、`npm run bundle` 重建。
- 本機以 Meta Muse low 實跑一個示範案例到 COMPLETED，確認 `assessment` 有內容且用語正確；線上部署後再跑一次。

## 6. 風險與取捨

- 多一次 LLM 呼叫：以 low 實測每步 15 到 50 秒，整案約增加 20 到 40 秒；步驤看門狗 300 秒足夠。
- 若模型漏產生 `defenses`，record 建構子以空清單兜底，前端區塊顯示「無」而不是壞頁。
- 合併到 `analyze` 一次產出可省一次呼叫，但 JSON 變大、Muse 畸形 JSON 機率上升，且失去獨立進度步驤，故不採。
