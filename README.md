# Taiwan Legal Graph × WebMCP

An agent-ready website that turns a fictional Taiwan legal dispute into a verified, interactive legal relationship graph. The human supplies facts and answers clarification questions; the Agent starts the workflow, polls status, reads analysis, verifies citations and focuses the graph. The human answering step deliberately has no WebMCP tool and cannot be bypassed.

## Architecture

```text
Browser (HTML/JS + WebMCP tools + graph view)
  → Spring Boot 4.1 / Embabel 1.5.1 / gpt-5.4-mini
  → Streamable HTTP MCP sidecar
  → Taiwan statutes and court judgments
```

The Embabel chain is brainstorm → human questions → research → element analysis → graph. Four `law-powers` skills are loaded directly from the Git submodule. Java enforces three rules after model output: law/judgment nodes must be anchored in research, element findings come only from analysis, and edge labels use a fixed whitelist.

## Why WebMCP

The running process and interactive graph live in the browser session. Ten imperative `document.modelContext.registerTool()` tools expose that state without forcing an Agent to guess DOM selectors: `listSampleCases`, `startCase`, `getCaseStatus`, `verifyCitation`, `resetCase`, `getAnalysis`, `getGraphSummary`, `focusNode`, `filterGraph`, and `explainEdge`. Base tools register first; graph tools register only after completion. Every result is capped at 1,500 characters. A built-in Tool Inspector provides the same operations in browsers without WebMCP.

## Run locally

Requires Java 21, Node 20, Docker and an OpenAI key.

```powershell
Copy-Item .env.example .env
# Fill OPENAI_API_KEY; CF_TUNNEL_TOKEN is optional for local use.
docker compose up -d --build
```

Open `http://localhost:8080`. For Java-only development set `LEGAL_MCP_URL=http://localhost:8000` and run `mvn spring-boot:run`.

## Tests

```powershell
mvn test
npm test
$env:E2E_LIVE='1'; npm run e2e
npm run eval
```

The E2E and evaluation commands require a running app, legal-mcp sidecar and a real `OPENAI_API_KEY`.

## Limitations and legal notice

This is an analysis aid, not legal advice. All sample cases are fictional; do not submit real personal data. State is in memory and disappears on restart. Court WAF behavior and model output can vary. File upload and dr-lawbot semantic search are outside the challenge scope. This repository is MIT licensed; the `law-powers` submodule retains its own licence and attribution restrictions.

Credits: law-powers, Embabel, mcp-taiwan-legal-db, Spring AI and the WebMCP community specification.
