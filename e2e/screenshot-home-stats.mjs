// 用途：UI 檢視用可重跑腳本——對 stub 伺服器（或 BASE_URL 指定的站台）截取「首頁能力入口」與「使用統計」兩頁，
//       桌機 1440 與手機 390 各一張，輸出到 docs/ui-review/pages/。工具檢視器維持預設隱藏，畫面即一般使用者所見。
//       執行：node e2e/stub-server.mjs 8090 &  然後  BASE_URL=http://localhost:8090 node e2e/screenshot-home-stats.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8090';
const OUT = 'docs/ui-review/pages';
mkdirSync(OUT, { recursive: true });

/** 兩種視窗寬度：桌機與常見手機。 */
const VIEWPORTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
/** 要截的頁面：hash 路由與等待出現的選擇器。 */
const PAGES = [
  { name: 'home', hash: '#/', ready: '.capability' },
  { name: 'stats', hash: '#/stats', ready: '.stats svg.chart' }
];

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, locale: 'zh-TW' });
    for (const p of PAGES) {
      await page.goto(`${BASE}/${p.hash}`);
      await page.waitForSelector(p.ready, { timeout: 15000 });
      // 等網頁字體載完再截，避免退回系統字體的假畫面
      await page.evaluate(() => document.fonts?.ready);
      const file = `${OUT}/${p.name}-${vp.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log('saved', file);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
