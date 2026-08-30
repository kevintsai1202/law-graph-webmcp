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
# 健康檢查：Streamable HTTP 沒 session 的 ping 會回 400，改送 initialize（不需 session，回 200）
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD curl -sf -o /dev/null -X POST http://localhost:8000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"healthcheck","version":"1"}}}' || exit 1
# 另關閉 DNS rebinding 保護：compose 內 app 以 Host: legal-mcp:8000 連線，預設白名單只認 localhost 會回 421。
# sidecar 不對外映射 port，僅 compose 內網可達，關閉此保護不擴大攻擊面。
CMD ["python", "-c", "from mcp_server.server import mcp; from mcp.server.transport_security import TransportSecuritySettings; mcp.settings.host='0.0.0.0'; mcp.settings.port=8000; mcp.settings.transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False); mcp.run(transport='streamable-http')"]
