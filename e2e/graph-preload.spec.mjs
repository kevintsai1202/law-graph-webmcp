import { test, expect } from '@playwright/test';
// 用途：驗證關聯圖 3D 套件的載入策略——
//       ① 案件仍在 RUNNING 時就背景預載三個 vendor 腳本（不必等結果、不必切到關係圖分頁）；
//       ② 三個腳本平行下載；③ 單一腳本首次下載停滯時會以 ?retry=1 重試並成功畫出圖。
//       只需 stub server（node e2e/stub-server.mjs）或任何後端；vendor 攔截由本檔自行處理。

/** 假的 COMPLETED 案件結果：含最小可畫的圖。 */
const completed = {
  caseId: 'preload-1', status: 'COMPLETED', step: 'GRAPH', locale: 'zh-TW',
  result: { graph: { nodes: [{ id: 'f1', group: 'fact', label: '事實' }, { id: 'i1', group: 'issue', label: '爭點' }], edges: [{ from: 'f1', to: 'i1', label: 'trigger' }] } }
};
/** 假的 RUNNING 案件狀態：永遠在跑，用來觀察預載。 */
const running = { caseId: 'preload-2', status: 'RUNNING', step: 'RESEARCH', locale: 'zh-TW', result: {} };

/** 進站前寫入 sessionStorage，讓 app.mount 走「續接案件」路徑。 */
async function resumeCase(page, caseId, outputs = ['graph']) {
  await page.addInitScript(({ caseId, outputs }) => {
    sessionStorage.setItem('caseId', caseId);
    sessionStorage.setItem('mode', 'case');
    sessionStorage.setItem('outputs', JSON.stringify(outputs));
  }, { caseId, outputs });
}

test('案件 RUNNING 時即背景平行預載三個 vendor 腳本', async ({ page }) => {
  const vendorRequests = [];
  page.on('request', (r) => { if (r.url().includes('/vendor/')) vendorRequests.push({ url: new URL(r.url()).pathname, at: Date.now() }); });
  await page.route('**/api/cases/preload-2', (route) => route.fulfill({ json: running }));
  await resumeCase(page, 'preload-2');
  await page.goto('/');
  await expect.poll(() => vendorRequests.length, { timeout: 10_000 }).toBe(3);
  expect(vendorRequests.map((r) => r.url).sort()).toEqual(['/vendor/3d-force-graph.min.js', '/vendor/three-spritetext.min.js', '/vendor/three.min.js']);
  // 平行：三個請求在極短時間內一起送出，而不是一個下載完才送下一個
  expect(vendorRequests[2].at - vendorRequests[0].at).toBeLessThan(500);
  // 仍在 RUNNING，畫面上沒有關聯圖畫布
  await expect(page.locator('#network-canvas')).toHaveCount(0);
});

test('單一 vendor 腳本首次停滯時自動以 ?retry=1 重試並成功畫圖', async ({ page }) => {
  const seen = [];
  // 第一次請求 3d-force-graph 永不回應（模擬 HTTP/3 停滯）；帶 retry 查詢字串的重試放行
  await page.route('**/vendor/3d-force-graph.min.js**', (route) => {
    const url = new URL(route.request().url());
    seen.push(url.pathname + url.search);
    if (!url.search) return; // 不 fulfill、不 abort → 掛住
    return route.continue();
  });
  await page.route('**/api/cases/preload-1', (route) => route.fulfill({ json: completed }));
  await resumeCase(page, 'preload-1');
  // 掛住的 vendor 請求會擋住 window load 事件，因此只等 DOMContentLoaded；首次逾時 15 秒後重試，故畫布最多等 40 秒
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#network-canvas canvas')).toBeVisible({ timeout: 40_000 });
  expect(seen).toEqual(['/vendor/3d-force-graph.min.js', '/vendor/3d-force-graph.min.js?retry=1']);
  await expect(page.locator('#network-canvas')).not.toContainText('載入失敗');
});
