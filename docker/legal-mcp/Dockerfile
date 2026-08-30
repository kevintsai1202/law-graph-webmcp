# 台灣法規判例 MCP 以 Streamable HTTP 對外服務，含 Playwright WAF fallback
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && playwright install --with-deps chromium \
 && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ENV FASTMCP_HOST=0.0.0.0 FASTMCP_PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD curl -sf -X POST http://localhost:8000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' || exit 1
CMD ["python", "-c", "from mcp_server.server import mcp; mcp.run(transport='streamable-http')"]
