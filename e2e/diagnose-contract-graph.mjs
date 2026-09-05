// 用途：重現「合約審查 → 關係圖分頁顯示『關聯圖載入失敗』」的問題。
//       以 sessionStorage 續接一個假案件（caseId 對應 artifacts/m3-live-contract.json 的真實 live 結果），
//       攔截 /api/cases/:id 回傳該 fixture，切到關係圖分頁，逐步記錄 console 錯誤、pageerror 與畫布內容。
// 執行：node e2e/diagnose-contract-graph.mjs [url] [--headed] [--no-quic]（--no-quic 關閉 HTTP/3，用來比對 QUIC 是否造成 vendor 下載停滯）
//       未帶 url 時打正式站 https://law-graph-webmcp.zeabur.app/
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const headed = process.argv.includes('--headed');
/** 真實 live 合約結果（COMPLETED，含 graph 36 節點／57 邊）。 */
const fixture = JSON.parse(await readFile(new URL('../artifacts/m3-live-contract.json', import.meta.url), 'utf8'));
const caseId = fixture.caseId;

// headless 需啟用 SwiftShader 才有 WebGL，否則會走「WebGL 不可用」橫幅而非真正的失敗路徑
const browser = await chromium.launch({ headless: !headed, args: [...(process.argv.includes('--no-quic') ? ['--disable-quic'] : []), '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ locale: 'zh-TW', viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', e.stack));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[console.${m.type()}]`, m.text()); });
// 記錄 vendor 腳本的請求／回應時間，判斷是網路慢還是根本沒發出請求
const t0 = Date.now();
page.on('request', (r) => { if (r.url().includes('/vendor/')) console.log(`[req +${Date.now() - t0}ms]`, r.url()); });
page.on('response', (r) => { if (r.url().includes('/vendor/')) console.log(`[res +${Date.now() - t0}ms]`, r.status(), r.url(), r.headers()['content-length'], r.headers()['content-encoding']); });
page.on('requestfinished', (r) => { if (r.url().includes('/vendor/')) console.log(`[done +${Date.now() - t0}ms]`, r.url()); });
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));

// 攔截案件查詢：回傳 fixture；其餘 API 放行（samples／me／quota 等走正式站）
await page.route(`**/api/cases/${caseId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
// 進站前先寫入 sessionStorage，讓 app.mount 走「續接案件」路徑
await page.addInitScript(({ id }) => {
  sessionStorage.setItem('caseId', id);
  sessionStorage.setItem('mode', 'contract');
  sessionStorage.setItem('outputs', JSON.stringify(['graph']));
}, { id: caseId });

await page.goto(url, { waitUntil: 'domcontentloaded' });
/** 記錄目前畫面：分頁列與畫布文字。 */
const state = async (label) => console.log(label, JSON.stringify(await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : '')),
  canvas: document.getElementById('network-canvas')?.textContent.slice(0, 80),
  canvasHasWebgl: !!document.getElementById('network-canvas')?.querySelector('canvas'),
  hasTHREE: !!window.THREE, hasFG: !!window.ForceGraph3D, hasSprite: !!window.SpriteText
}))));
await state('載入後');
const graphTab = page.getByRole('tab', { name: /關係圖|Graph/ });
await graphTab.click();
// 等到畫布出現或載入失敗文字，最多 40 秒（首次逾時 15 秒＋重試）；記錄實際等了多久
const tStart = Date.now();
await page.waitForFunction(() => { const c = document.getElementById('network-canvas'); return c && (c.querySelector('canvas') || /失敗|could not/.test(c.textContent)); }, null, { timeout: 40000 }).catch(() => {});
await state(`切到關係圖 ${Math.round((Date.now() - tStart) / 1000)}s 後`);
// 直接在頁面內重跑 render，把同步例外原文抓出來（renderGraph 只 console.error）
const direct = await page.evaluate(async (graph) => {
  try { window.__graphView.render(graph); return { ok: true }; } catch (e) { return { ok: false, message: e.message, stack: e.stack }; }
}, fixture.result.graph);
console.log('直接 render 結果', JSON.stringify(direct, null, 2));
await page.screenshot({ path: 'e2e/screenshots/diagnose-contract-graph.png', fullPage: true });
await browser.close();
