# law-graph-webmcp

## Zeabur Deployment
- Project ID: 6a94e7dc2ed2e7dbfbd22854（law-graph-webmcp，專屬伺服器 server-69eeeb93f5343e60f36375c2）
- Service ID（app，Spring Boot 主站）: 6a94e90bb869c167a93d3b2e
- Service ID（legal-mcp，台灣法規判例 MCP sidecar）: 6a94e8c3b869c167a93d3b08
- 重佈指令（只重佈 app）：`npx zeabur@latest deploy --project-id 6a94e7dc2ed2e7dbfbd22854 --service-id 6a94e90bb869c167a93d3b2e --json`
- app 環境變數：OPENAI_API_KEY／MODEL／LEGAL_MCP_URL=http://legal-mcp.zeabur.internal:8000
- 建置設定：zbpack.json 指向 docker/app/Dockerfile（多階段 Maven 建置，技能包一併 COPY 進映像）
