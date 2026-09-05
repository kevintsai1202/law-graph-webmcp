// 用途：重現 visual.spec「outputs」測試在 375 寬度卡住的問題：逐步記錄案情框的值、是否隱藏、字數計數與送出鈕狀態。
// 執行：node e2e/diagnose-outputs.mjs [url]
import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) || 'https://law-graph-webmcp.zeabur.app/';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'zh-TW', viewport: { width: 375, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const state = async (label) => console.log(label, JSON.stringify(await page.evaluate(() => {
  const ta = document.getElementById('case-text'), pv = document.getElementById('case-preview');
  return { value: ta?.value.slice(0, 20), taHidden: ta?.hidden, pvHidden: pv?.hidden, pvText: pv?.textContent.slice(0, 20), count: document.getElementById('case-count')?.textContent, disabled: document.getElementById('case-submit')?.disabled, active: document.activeElement?.id };
})));
await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('.sample').first().waitFor();
await state('初始');
await page.fill('#case-text', '甲駕車進入市區十字路口後，與乙車發生碰撞，乙主張甲闖紅燈並請求醫療費與薪資損失。');
await state('fill 後');
await page.uncheck('input[name="outputs"][value="graph"]');
await state('uncheck graph 後');
await page.check('input[name="outputs"][value="graph"]');
await page.check('input[name="outputs"][value="complaint"]');
await state('check 後');
await browser.close();
