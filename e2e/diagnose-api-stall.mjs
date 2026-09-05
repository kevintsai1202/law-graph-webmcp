// 用途：量測正式站「小型 API 回應」在瀏覧器（HTTP/3 開啟）下是否也會像 vendor 大檔一樣停滯——
//       前端輪詢 GET /api/cases/{id} 與 POST /answers 若停滯且 fetch 無逾時，畫面就會永久沒反應。
//       在頁面內連續 fetch N 次，記錄每次耗時，超過門檻視為停滯。
// 執行：node e2e/diagnose-api-stall.mjs [--n=120] [--path=/api/cases/jovial_keller] [--no-quic] [url]
import { chromium } from 'playwright';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const N = Number(arg('n', 120));
const path = arg('path', '/api/version');
const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const noQuic = process.argv.includes('--no-quic');
/** 單次請求超過此毫秒數即視為停滯（正常 0.2～0.6 秒）。 */
const STALL_MS = 8000;

const browser = await chromium.launch({ args: noQuic ? ['--disable-quic'] : [] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
// 先讓瀏覧器學到 Alt-Svc h3，再開始量測
await page.waitForTimeout(1500);
const result = await page.evaluate(async ({ N, path, STALL_MS }) => {
  const times = [];
  let stalls = 0, errors = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    try {
      // 每次帶不同查詢字串避免任何快取；逾時用 AbortSignal 收尾以免整個量測掛住
      await fetch(`${path}?i=${i}&t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(STALL_MS) });
    } catch (e) { if (e?.name === 'TimeoutError') stalls++; else errors++; }
    times.push(Math.round(performance.now() - t));
    await new Promise((r) => setTimeout(r, 150));
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { N, stalls, errors, p50: sorted[Math.floor(N * 0.5)], p95: sorted[Math.floor(N * 0.95)], max: sorted[N - 1], protocol: performance.getEntriesByType('resource').filter((r) => r.name.includes(path)).map((r) => r.nextHopProtocol).filter((v, i, a) => a.indexOf(v) === i) };
}, { N, path, STALL_MS });
console.log(JSON.stringify({ quic: !noQuic, path, ...result }));
await browser.close();
