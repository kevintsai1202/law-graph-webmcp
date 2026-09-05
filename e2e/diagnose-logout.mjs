// 用途：重現「登出後首頁卡住」：比較幾種登出方式（fetch redirect manual／follow、之後 reload 或 assign），記錄文件請求有沒有回應。
// 執行：node e2e/diagnose-logout.mjs [url] [--browser=firefox]
import { chromium, firefox } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const engine = (process.argv.find((a) => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
const browser = await (engine === 'firefox' ? firefox : chromium).launch();

/** 跑一種登出變化：回傳文件請求是否在 15 秒內收到回應與最後狀態。 */
async function variant(name, logoutJs, afterJs) {
  const page = await browser.newPage({ locale: 'zh-TW' });
  const events = [];
  page.on('request', (q) => { if (q.resourceType() === 'document') events.push(`req ${q.method()} ${q.url()}`); });
  page.on('response', (r) => { if (r.request().resourceType() === 'document') events.push(`res ${r.status()} ${r.url()} ${r.headers()['location'] || ''}`); });
  page.on('requestfailed', (q) => events.push(`failed ${q.url()} ${q.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  const logoutResult = await page.evaluate(logoutJs);
  events.push(`logout → ${JSON.stringify(logoutResult)}`);
  let outcome = 'ok';
  try {
    await Promise.race([page.evaluate(afterJs), page.waitForTimeout(100)]);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForTimeout(2500);
    const view = await page.evaluate(() => ({ app: typeof window.__lawGraphApp, stage: document.getElementById('stage')?.innerHTML.length ?? -1 }));
    outcome = JSON.stringify(view);
  } catch (e) { outcome = 'TIMEOUT: ' + e.message.split('\n')[0]; }
  console.log(`\n== ${name} ==\n${events.join('\n')}\noutcome: ${outcome}`);
  await page.close();
}

await variant('A. fetch manual + reload（目前線上做法）',
  async () => { const r = await fetch('/logout', { method: 'POST', redirect: 'manual' }); return { type: r.type, status: r.status }; },
  () => location.reload());
await variant('B. fetch follow + reload',
  async () => { const r = await fetch('/logout', { method: 'POST' }); return { type: r.type, status: r.status, url: r.url }; },
  () => location.reload());
await variant('C. fetch manual + assign(/)',
  async () => { const r = await fetch('/logout', { method: 'POST', redirect: 'manual' }); return { type: r.type, status: r.status }; },
  () => location.assign('/'));
await variant('D. 表單 POST 送出（瀏覽器跟隨 302）',
  () => 'form',
  () => { const f = document.createElement('form'); f.method = 'POST'; f.action = '/logout'; document.body.appendChild(f); f.submit(); });
await browser.close();
