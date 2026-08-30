# 台灣法規判例 MCP 以 Streamable HTTP 對外服務，含 Playwright WAF fallback
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && playwright install --with-deps chromium \
 && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
# 注意：mcp-taiwan-legal-db 1.0.0 的 FastMCP 實例不讀 FASTMCP_HOST／FASTMCP_PORT，
# 預設只綁 127.0.0.1，容器外連不到（HTTP EOF）；故於啟動指令直接覆寫 settings.host／port。
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD curl -sf -X POST http://localhost:8000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' || exit 1
CMD ["python", "-c", "from mcp_server.server import mcp; mcp.settings.host='0.0.0.0'; mcp.settings.port=8000; mcp.run(transport='streamable-http')"]
