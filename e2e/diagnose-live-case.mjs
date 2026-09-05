// 用途：用正式站「真實案件 id」重現前端畫面——以 sessionStorage 續接該案件，記錄 pageerror／console 錯誤、
//       app state、輪詢請求與畫面關鍵節點，判斷「後端狀態正常但前端無反應」是哪一層出問題。
// 執行：node e2e/diagnose-live-case.mjs <caseId> <case|contract> [url]
import { chromium } from 'playwright';

const [caseId, mode = 'case'] = process.argv.slice(2);
const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
if (!caseId) { console.error('用法：node e2e/diagnose-live-case.mjs <caseId> <case|contract>'); process.exit(2); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ locale: 'zh-TW', viewport: { width: 1400, height: 900 } });
const t0 = Date.now();
page.on('pageerror', (e) => console.log(`[pageerror +${Date.now() - t0}ms]`, e.message, '\n', e.stack));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[console.${m.type()} +${Date.now() - t0}ms]`, m.text()); });
page.on('response', (r) => { if (r.url().includes('/api/')) console.log(`[api +${Date.now() - t0}ms]`, r.status(), new URL(r.url()).pathname); });
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));

await page.addInitScript(({ caseId, mode }) => {
  sessionStorage.setItem('caseId', caseId);
  sessionStorage.setItem('mode', mode);
  sessionStorage.setItem('outputs', JSON.stringify(['graph']));
}, { caseId, mode });
await page.goto(url, { waitUntil: 'domcontentloaded' });
/** 取 app state 與畫面關鍵節點。 */
const snapshot = () => page.evaluate(() => {
  const s = window.__lawGraphApp?.getState?.();
  return {
    view: s?.view, status: s?.last?.status, step: s?.last?.step, questions: s?.last?.questions?.length,
    hasQuestionsForm: !!document.getElementById('questions-form'),
    submitBtn: !!document.querySelector('#questions-form button[type=submit]'),
    progressActive: document.querySelector('.progress .step.active')?.textContent?.trim(),
    stageText: document.getElementById('stage')?.textContent?.replace(/\s+/g, ' ').slice(0, 160)
  };
});
for (const wait of [2000, 4000, 6000]) {
  await page.waitForTimeout(wait);
  console.log(`+${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(await snapshot()));
}
await page.screenshot({ path: `e2e/screenshots/diagnose-live-${caseId}.png`, fullPage: true });
await browser.close();
