// 用途：診斷首頁是否卡在初始畫面（例如登入後回到 / 卻沒有渲染）。
// 開啟指定網址，收集 console 錯誤與失敗的網路請求，並回報 #stage 是否有內容、頁首 i18n 是否套用。
// 執行：node e2e/diagnose-home.mjs [url]   （預設線上網址；可加 --headed 觀察）
import { chromium, firefox, webkit } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const headed = process.argv.includes('--headed');
// --browser=firefox|webkit|chromium：不同引擎行為可能不同（例如 Firefox 的追蹤保護）
const engine = (process.argv.find((a) => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
const browser = await ({ firefox, webkit, chromium }[engine] || chromium).launch({ headless: !headed });
// --width=<px>：以指定視窗寬度開啟（手機 375、平板 768）；--shot=<path>：截整頁存檔供人工檢視
const width = Number((process.argv.find((a) => a.startsWith('--width=')) || '--width=1280').split('=')[1]);
const shot = (process.argv.find((a) => a.startsWith('--shot=')) || '').split('=')[1];
const page = await browser.newPage({ locale: 'zh-TW', viewport: { width, height: 800 }, deviceScaleFactor: 1 });
// --stale-case=<id>：模擬 sessionStorage 留有已不存在的案件（例如部署後遺失），觀察 mount 是否卡住
const stale = (process.argv.find((a) => a.startsWith('--stale-case=')) || '').split('=')[1];
if (stale) await page.addInitScript((id) => { try { sessionStorage.setItem('caseId', id); } catch {} }, stale);
const errors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
// --session-first：先踩 /oauth2/authorization/google 取得 JSESSIONID（不真的登入），再回首頁，觀察帶 session cookie 是否影響載入
if (process.argv.includes('--session-first')) {
  await page.route('**accounts.google.com/**', (r) => r.fulfill({ status: 200, body: 'blocked' }));
  await page.goto(new URL('/oauth2/authorization/google', url).href, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('cookies after login-start:', (await page.context().cookies()).map((c) => `${c.name}=${c.value.slice(0, 8)}…`).join(', '));
}
// --mock-login：把 /api/me 與 /api/quota 換成已登入的回應，模擬 Google 登入後的前端狀態（不需真的登入）
if (process.argv.includes('--mock-login')) {
  await page.route('**/api/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, loggedIn: true, name: 'Kevin Tsai', email: 'k@example.com', picture: 'https://lh3.googleusercontent.com/a/x=s96-c', loginPath: '/oauth2/authorization/google', blocked: false, blockedMessage: null }) }));
  await page.route('**/api/quota', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: '2026-09-05', used: 0, limit: 5, remaining: 5, exhausted: false, loggedIn: true, memberLimit: 5, loginPath: '/oauth2/authorization/google' }) }));
}
// --css=<本機檔案>：把線上 app.css 換成本機檔，不用部署就能預覽 RWD 修改
const cssOverride = (process.argv.find((a) => a.startsWith('--css=')) || '').split('=')[1];
if (cssOverride) await page.route('**/css/app.css*', (r) => r.fulfill({ path: cssOverride, contentType: 'text/css' }));
const all = [];
page.on('response', (r) => all.push(`${r.status()} ${r.request().resourceType()} ${r.url().replace(url, '/')}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  title: document.querySelector('h1')?.textContent,
  stageChars: document.getElementById('stage')?.innerHTML.length ?? -1,
  badge: document.getElementById('agent-badge')?.textContent,
  authSlot: document.getElementById('auth-slot')?.innerHTML.slice(0, 120),
  hasApp: typeof window.__lawGraphApp,
  view: window.__lawGraphApp?.getState?.()?.view
}));
// --textarea-probe：量測案情輸入框在初始、focus、輸入、blur 各階段的高度，追查「失焦時縮小」問題
if (process.argv.includes('--textarea-probe')) {
  const h = () => page.evaluate(() => { const t = document.getElementById('case-text'); const cs = getComputedStyle(t); return { offset: t.offsetHeight, rows: t.rows, cssHeight: cs.height, minH: cs.minHeight, flexShrink: cs.flexShrink, inlineStyle: t.getAttribute('style') }; });
  const probe = { initial: await h() };
  await page.click('#case-text'); probe.focused = await h();
  await page.type('#case-text', '甲於2024年1月駕車撞傷乙，乙住院兩週並支出醫療費十萬元。'); probe.typed = await h();
  await page.click('h1'); await page.waitForTimeout(300); probe.blurred = await h();
  await page.click('#case-text'); await page.waitForTimeout(300); probe.refocused = await h();
  console.log('textarea probe:', JSON.stringify(probe, null, 1));
}
if (shot) { await page.screenshot({ path: shot, fullPage: true }); console.log('screenshot:', shot); }
console.log(JSON.stringify({ url, info, errors, failed, requests: all.filter((l) => !/\.(png|svg|woff2?)/.test(l)).slice(0, 25) }, null, 2));
await browser.close();
