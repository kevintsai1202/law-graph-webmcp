// 用途：在正式站以真實案件 id 續接「等待作答」的案件，於瀏覧器內填答並按「繼續」，
//       之後每 5 秒記錄 app state／畫面，遇到下一輪問題就再答（最多 3 輪），直到 RESULT／FAILED 或逾時。
//       用來驗證「按繼續後無反應」修法在真實路徑（真 LLM、真輪詢）上的行為。
// 執行：node e2e/diagnose-live-answer.mjs <caseId> <case|contract> [--max-minutes=8] [url]
import { chromium } from 'playwright';

const [caseId, mode = 'case'] = process.argv.slice(2).filter((a) => !a.startsWith('--') && !a.startsWith('http'));
const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const maxMinutes = Number((process.argv.find((a) => a.startsWith('--max-minutes=')) || '').split('=')[1] || 8);
if (!caseId) { console.error('用法：node e2e/diagnose-live-answer.mjs <caseId> <case|contract>'); process.exit(2); }
const ANSWER = '有，事故後警方到場製作紀錄並開立事故初步分析研判表；有醫院診斷證明與收據；尚未提出刑事告訴或向保險公司申請。';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ locale: 'zh-TW', viewport: { width: 1400, height: 900 } });
const t0 = Date.now();
const elapsed = () => `+${Math.round((Date.now() - t0) / 1000)}s`;
page.on('pageerror', (e) => console.log(`[pageerror ${elapsed()}]`, e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[console.error ${elapsed()}]`, m.text().slice(0, 300)); });
page.on('response', (r) => { const p = new URL(r.url()).pathname; if (p.includes('/api/cases')) console.log(`[api ${elapsed()}]`, r.request().method(), r.status(), p); });

await page.addInitScript(({ caseId, mode }) => {
  sessionStorage.setItem('caseId', caseId);
  sessionStorage.setItem('mode', mode);
  sessionStorage.setItem('outputs', JSON.stringify(['graph']));
}, { caseId, mode });
await page.goto(url, { waitUntil: 'domcontentloaded' });

/** 取 app state 與畫面關鍵節點。 */
const snapshot = () => page.evaluate(() => {
  const s = window.__lawGraphApp?.getState?.();
  return { view: s?.view, status: s?.last?.status, step: s?.last?.step, questions: s?.last?.questions?.map((q) => q.id).join(','),
    form: !!document.getElementById('questions-form'), canvas: !!document.querySelector('#network-canvas canvas'),
    active: document.querySelector('.progress .step.active')?.textContent?.replace(/\s+/g, ' ').trim() };
});

let rounds = 0;
const deadline = t0 + maxMinutes * 60_000;
let last = '';
while (Date.now() < deadline) {
  const s = await snapshot();
  const line = JSON.stringify(s);
  if (line !== last) { console.log(elapsed(), line); last = line; }
  if (s.view === 'RESULT' || s.view === 'FAILED') break;
  if (s.view === 'QUESTIONS' && s.form && rounds < 3) {
    rounds++;
    const areas = page.locator('#questions-form textarea');
    const n = await areas.count();
    for (let i = 0; i < n; i++) await areas.nth(i).fill(ANSWER);
    console.log(elapsed(), `第 ${rounds} 輪：填 ${n} 題後按「繼續」`);
    await page.click('#questions-form button[type=submit]');
    // 送出後 3 秒內畫面必須離開原表單（RUNNING 或新一輪問題），否則就是「按了沒反應」
    await page.waitForTimeout(3000);
    const after = await snapshot();
    console.log(elapsed(), '送出 3 秒後', JSON.stringify(after));
    if (after.form && after.questions === s.questions) console.log('!! 送出後仍停在同一組問題 —— 重現「按繼續無反應」');
    continue;
  }
  await page.waitForTimeout(5000);
}
console.log(elapsed(), '結束', JSON.stringify(await snapshot()));
await page.screenshot({ path: `e2e/screenshots/diagnose-live-answer-${caseId}.png`, fullPage: true });
await browser.close();
