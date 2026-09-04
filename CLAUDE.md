# law-graph-webmcp

## Zeabur Deployment
- Project ID: 6a94e7dc2ed2e7dbfbd22854（law-graph-webmcp，專屬伺服器 server-69eeeb93f5343e60f36375c2）
- Service ID（app，Spring Boot 主站）: 6a94e90bb869c167a93d3b2e
- Service ID（legal-mcp，台灣法規判例 MCP sidecar）: 6a94e8c3b869c167a93d3b08
- 重佈指令（只重佈 app）：`npx zeabur@latest deploy --project-id 6a94e7dc2ed2e7dbfbd22854 --service-id 6a94e90bb869c167a93d3b2e --json`
- app 環境變數：OPENAI_API_KEY／MODEL／LEGAL_MCP_URL=http://legal-mcp.zeabur.internal:8000
- 檢索逾時（2026-09-04 起）：LAWGRAPH_KEYWORD_TIMEOUT=60s、LAWGRAPH_RESEARCH_TIMEOUT=90s（legal-mcp 遇司法院 WAF 會 Playwright 暖機約 8 秒，30s 常逾時）；semantic 維持 20s。
- 每日 token 預算：LAWGRAPH_DAILY_TOKEN_LIMIT（預設 2000000）、LAWGRAPH_LLM_PAUSED（手動停用）、LAWGRAPH_USAGE_STORE=db＋LAWGRAPH_DB_URL=jdbc:postgresql://postgresql.zeabur.internal:5432/zeabur、LAWGRAPH_DB_USER=${POSTGRES_USERNAME}、LAWGRAPH_DB_PASSWORD=${POSTGRES_PASSWORD}（同專案 postgresql 服務 ID 6a9a72cb73ef6eb935f3166f，含持久卷）。GET /api/usage 可查今日用量與 store。
- 建置設定：zbpack.json 指向 docker/app/Dockerfile（多階段 Maven 建置，技能包一併 COPY 進映像）
