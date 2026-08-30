# Taiwan Legal Graph × WebMCP

**One sentence:** paste a fictional Taiwan legal dispute, answer a few questions only you can answer, and get a verified, interactive 3D legal-relationship graph — every step of which your browser Agent can drive through ten WebMCP tools, except the answering.

![Completed graph for the car-accident sample (live gpt-5.4-nano run, 繁體中文 UI)](docs/images/completed-graph.png)

![Tool Inspector running focusNode on the rendered graph](docs/images/smoke-graph.png)

> 中文摘要：把 law-powers 法律技能包做成網站。貼入案情 → 頭腦風暴 → 使用者回答提問 → 檢索法規判決 → 涵攝分析 → 3D 法律關係圖；頁面以 WebMCP 暴露十個工具供 ChatGPT／Chrome Agent 操作，但「回答提問」刻意沒有工具，人不可被繞過。

## Why WebMCP

The state that matters lives only in the browser tab: the running workflow, the questions waiting for a human, the rendered 3D graph and its camera. A REST API cannot hand an Agent the *page*. WebMCP lets the page itself publish a small, typed contract:

- **Agent:** `listSampleCases` → `startCase` → poll `getCaseStatus` → read `getAnalysis` / `getGraphSummary` → `focusNode` / `filterGraph` / `explainEdge` → `verifyCitation` on anything it wants to quote.
- **Human:** answers the clarification questions on the page. There is deliberately **no `answerQuestions` tool** — the Agent can report *that* the case is `WAITING` and *what* is being asked, but cannot answer on the human's behalf.

Tools are registered imperatively with `document.modelContext.registerTool()` and in two phases: five *base* tools on page load, five *graph* tools only after the analysis reaches `COMPLETED` (and they are unregistered again on `resetCase`). Every result is capped at 1,500 characters. Browsers without WebMCP get the same ten operations through a built-in Tool Inspector.

## What humans and agents accomplish together

```text
Human pastes facts ──► Agent: startCase ──► BRAINSTORM ──► QUESTIONS (human answers on page)
                                                   │
                        Agent: getCaseStatus ◄─────┘──► RESEARCH (taiwan-legal-db) ──► ANALYSIS ──► GRAPH
                                                                                                │
                        Agent: getGraphSummary / focusNode / explainEdge / verifyCitation ◄─────┘
```

Video script skeleton: (1) open the site in ChatGPT, list samples; (2) Agent starts `car-accident`; (3) progress bar advances, page turns to *questions* — Agent relays them, human types answers; (4) graph appears; Agent summarises, flies to 民法第184條, explains an edge; (5) Agent verifies a citation against law.moj.gov.tw.

## Architecture

```text
Browser (HTML/JS, no framework)
  ├─ views/*.js        pure render(model, locale) → HTML string (node-tested, all model text escaped)
  ├─ graphView.js      law-powers 3D renderer (three.js + 3d-force-graph) as an ES module
  ├─ webmcp.js         ten tool definitions + execute, phase-based registration
  └─ inspector.js      manual runner for the same ten tools
        │ 2 s polling  GET /api/cases/{id}
Spring Boot 4.1 / Embabel 1.5.1 (Java 21)
  ├─ LegalGraphAgent   five @Action steps + WaitFor.awaitable (human questions)
  ├─ Skills            law-powers legal-brainstorming / legal-research / legal-element-analysis / legal-graph
  ├─ GraphRules        4 hard rules after model output: every node needs a whitelisted group (inferred from
  │                    ref/jid when the model omits it), law/judgment nodes must be anchored in research,
  │                    element findings only from analysis, edge labels from a fixed whitelist
  └─ Spring AI MCP client ──► legal-mcp sidecar (Python, mcp-taiwan-legal-db, Streamable HTTP)
                                 └─ law.moj.gov.tw statutes · judicial.gov.tw judgments
```

Only six sidecar tools are whitelisted for the Agent: `search_regulations`, `query_regulation`, `get_pcode`, `search_judgments`, `get_judgment`, `get_citations`. The LLM is `gpt-5.4-nano` (`embabel.models.default-llm`; Embabel 1.5.1 ships the model definition in `models/openai-models.yml`).

## WebMCP implementation

```js
// src/main/resources/static/js/webmcp.js (excerpt)
{ name: 'startCase', phase: 'base', annotations: {},
  description: 'Start analysing a Taiwan legal dispute from free text or a sample id. Returns caseId and status.',
  inputSchema: S({ caseText: { type: 'string', minLength: 20 }, sampleId: { type: 'string' }, locale: LOCALE }) }

await modelContext.registerTool({ name, description, inputSchema, annotations,
  execute: (input) => exec[name](input || {}) }, { signal: controller.signal });
```

| Tool | Phase | Read-only | Purpose |
| --- | --- | --- | --- |
| `listSampleCases` | base | ✓ | Fictional sample disputes (en / zh-TW) |
| `startCase` | base | | Start from `caseText` or `sampleId`; refuses if a case is in progress |
| `getCaseStatus` | base | ✓ | `RUNNING` step, `WAITING` + questions, `COMPLETED`, `FAILED` (never the full result) |
| `verifyCitation` | base | ✓ | Does 民法第184條 / 最高法院…字第…號 exist in the official databases? |
| `resetCase` | base | | Back to the input screen; graph tools are unregistered |
| `getAnalysis` | completed | ✓ (untrusted content) | One section: `brainstorm`, `research`, `analysis` |
| `getGraphSummary` | completed | ✓ | Node counts by group, edges, issues, unmet elements |
| `focusNode` | completed | | Fly the camera to a node by id or label text; returns neighbours |
| `filterGraph` | completed | | Show only some groups / one family; `reset` |
| `explainEdge` | completed | ✓ | Label, relation type and note of one edge |

Environment notes: in **Chrome 149+** enable `chrome://flags/#enable-webmcp-testing`, then `await document.modelContext.getTools()` returns 5 tools on load and 10 after completion. In the **ChatGPT desktop app**, the address-bar *Site tools* list shows the same five base tools. The declarative (`<form>`-based) WebMCP API is not used.

## UI design system

The front end follows the **Trust & Authority** pattern from `ui-ux-pro-max` (`design-system/law-graph/MASTER.md`): ivory background, navy primary (`#1e3a8a`), gold accents, EB Garamond / Noto Serif TC headings, Inter / Noto Sans TC body. Every colour, spacing, radius and duration is a CSS token in `static/css/app.css`; components never hard-code hex values. Built-in checks: 4.5:1 contrast, 44 px touch targets, visible `:focus-visible` rings, `aria-current` stepper, `tablist` tabs with arrow-key navigation, inline validation on the case text (submit enabled at 20 chars), element findings encoded by symbol + text + colour, `prefers-reduced-motion`, and no horizontal scroll at 375/768/1440 (`npm run e2e:visual`).

## Run locally

Requires Java 21, Node 20+, Docker and an OpenAI key.

```powershell
Copy-Item .env.example .env          # fill OPENAI_API_KEY; CF_TUNNEL_TOKEN only for the tunnel
docker compose up -d --build         # app + legal-mcp (+ cloudflared if the token is set)
```

Open `http://localhost:8080`. For Java-only development run the sidecar in Docker and the app from Maven:

```powershell
docker compose up -d --build legal-mcp
$env:OPENAI_API_KEY = '...'; $env:LEGAL_MCP_URL = 'http://localhost:8000'
mvn spring-boot:run
```

The sidecar binds `0.0.0.0:8000` explicitly (`mcp.settings.host`), because `mcp-taiwan-legal-db` 1.0.0 ignores `FASTMCP_HOST` and would otherwise listen on `127.0.0.1` inside the container.

## Tests

```powershell
mvn test                                    # 36 unit tests (domain rules, prompts, agent, REST, rate limit)
mvn verify -Dtest=LegalMcpIT                # starts the real sidecar via Testcontainers, verifies 民法第184條
npm test                                    # 24 node --test cases: i18n, state machine, client, views, graph, WebMCP contract
npm run e2e                                 # Playwright: smoke (no LLM; fake modelContext) + journey (needs E2E_LIVE=1)
npm run stub                                # static + stubbed /api server on :8090 — no Spring Boot, no LLM
$env:BASE_URL='http://localhost:8090'; npm run e2e:visual   # UI/a11y regression: 375/768/1440 screenshots -> docs/ui-review/
$env:E2E_LIVE='1'; npm run e2e              # full human/agent journey against a live backend
npm run eval                                # 4 samples × 2 locales; counts nodes removed by the hard rules → eval/
```

`e2e/smoke.spec.mjs` injects a fake `document.modelContext` so the two-phase registration (5 → 10 → 5 tools) is asserted even in a browser without WebMCP.

### Tutorial screenshots

```powershell
$env:E2E_LIVE='1'; npx playwright test -c e2e/playwright.config.mjs e2e/tutorial.spec.mjs
```

`e2e/tutorial.spec.mjs` walks the whole human/agent journey in **English and 繁體中文** and saves one screenshot per action to `docs/tutorial/<locale>/NN-*.png` (21 frames each: input → progress with partial results → questions → answers → graph → four tabs → every Inspector tool → focus/detail panel → filter → verify citation → new case). These frames are the storyboard for the demo video. While a case runs, the page already lists the results of finished steps under *Results so far*, and every progress screen has a *Cancel and start over* button.

## Limitations

- `gpt-5.4-nano` output quality varies (more than mini); the hard rules remove unverifiable nodes rather than "fix" them, so graphs can be small. Switch back with `embabel.models.default-llm: gpt-5.4-mini` if quality matters more than cost.
- The judicial.gov.tw WAF can block judgment lookups; the sidecar falls back to Playwright but may still fail.
- Case state is in memory only; a restart loses running cases. Rate limit is 10 cases / hour / IP.
- No file upload; the semantic `dr-lawbot` search from law-powers is intentionally not connected.
- Live E2E / eval / tunnel steps require a real `OPENAI_API_KEY` and `CF_TUNNEL_TOKEN`; they are not run in CI.

## Legal notice

This is an analysis aid, **not legal advice**. All sample cases are fictional; do not paste real personal data. This repository is MIT licensed. `law-powers` is included as a Git submodule and keeps its own licence, including its stated restriction (free for everyone except 經兆國際法律事務所).

## Credits

[law-powers](https://github.com/kevintsai1202/law-powers) · [Embabel](https://github.com/embabel/embabel-agent) · [mcp-taiwan-legal-db](https://pypi.org/project/mcp-taiwan-legal-db/) · [3d-force-graph](https://github.com/vasturiano/3d-force-graph) · Spring AI · the WebMCP community specification.
