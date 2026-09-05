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
/** 入口回歸模式只供本機 UI 驗證，登入為假身分，不呼叫 Google 或 LLM。 */
const entryMode = process.argv.includes('--entry');
const slowEntry = process.argv.includes('--slow-entry');
const failGraph = process.argv.includes('--fail-graph');
let member = false;
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
    if (entryMode) {
      if (url.pathname === '/api/me') return json(res, 200, { enabled: true, loggedIn: member, name: member ? '入口測試帳號' : null, loginPath: '/oauth2/authorization/google', blocked: false });
      if (url.pathname === '/oauth2/authorization/google' || (url.pathname === '/logout' && req.method === 'POST')) {
        member = url.pathname !== '/logout';
        res.writeHead(302, { Location: '/' }); return res.end();
      }
      if (slowEntry && ['/api/usage', '/api/auth/tw-legal-rag/status', '/api/quota', '/api/samples'].includes(url.pathname)) return;
      if (url.pathname === '/api/auth/tw-legal-rag/status') return json(res, 200, { enabled: false });
      if (url.pathname === '/api/usage') return json(res, 200, { paused: false });
      if (url.pathname === '/api/quota') return json(res, 200, { used: 0, limit: member ? 5 : 1, remaining: member ? 5 : 1, memberLimit: 5, loggedIn: member });
      if (failGraph && url.pathname.startsWith('/vendor/')) return json(res, 503, { error: 'test-only graph failure' });
      if (url.pathname.startsWith('/api/cases/')) return json(res, 200, {
        caseId: 'stub-1', status: 'COMPLETED', step: 'GRAPH', locale: 'zh-TW',
        result: { brainstorm: { facts: ['入口流程測試，非真實案件'] }, analysis: { elements: [], strategy: '本機測試結果' }, research: { laws: [], judgments: [] },
          graph: { nodes: [{ id: 'f1', group: 'fact', label: '測試事實' }, { id: 'i1', group: 'issue', label: '測試爭點' }], edges: [{ from: 'f1', to: 'i1', label: 'trigger' }] } }
      });
    }
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
server.listen(PORT, '127.0.0.1', () => console.log(`stub server http://localhost:${PORT}`));
