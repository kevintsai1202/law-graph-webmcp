// 用途：不需 Spring Boot／LLM 的前端 stub 伺服器——提供靜態檔與最小 /api 假回應，
//       讓 smoke／visual E2E 可在純前端環境重跑（UI 改版驗證、截圖）。
//       執行：node e2e/stub-server.mjs [port]（預設 8090），再以 BASE_URL=http://localhost:8090 跑 Playwright。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/main/resources/', import.meta.url));
const STATIC = join(ROOT, 'static');
const PORT = Number(process.argv[2] || process.env.PORT || 8090);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** 假的進行中案件狀態：BRAINSTORM 已完成、RESEARCH 進行中，帶中間成果。 */
const running = {
  caseId: 'stub-1', status: 'RUNNING', step: 'RESEARCH', locale: 'en',
  result: { brainstorm: { facts: ['A ran a red light and hit B'], relations: ['A owes B tort damages'], issues: ['Negligence'], evidenceNeeds: ['Dashcam'], questions: [] } }
};

/** 回 JSON。 */
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/samples') {
      const locale = url.searchParams.get('locale') === 'zh-TW' ? 'zh-TW' : 'en';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(await readFile(join(ROOT, 'samples', `${locale}.json`)));
    }
    if (url.pathname === '/api/cases' && req.method === 'POST') return json(res, 200, { caseId: 'stub-1', status: 'RUNNING', step: 'BRAINSTORM' });
    if (url.pathname.startsWith('/api/cases/')) return json(res, 200, running);
    if (url.pathname.startsWith('/api/laws/verify')) return json(res, 200, { ref: url.searchParams.get('ref'), exists: true, source: 'stub', text: '' });
    // 靜態檔：防止路徑跳脫
    const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^([.][.][\\/])+/, '');
    const file = join(STATIC, rel);
    if (!file.startsWith(STATIC)) return json(res, 403, { error: 'forbidden' });
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    json(res, e.code === 'ENOENT' ? 404 : 500, { error: e.code || 'ERROR', message: e.message });
  }
});
server.listen(PORT, () => console.log(`stub server http://localhost:${PORT}`));
