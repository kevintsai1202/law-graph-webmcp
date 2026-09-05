import { test, expect } from '@playwright/test';
// 用途：入口 stub 模式（node e2e/stub-server.mjs 8090 --entry）專用場景，一般 smoke.spec.mjs 不涵蓋。
// 只在 ENTRY_MODE=1 時執行；一般 npm test／預設 smoke 執行時全數跳過，不影響既有流程。
test.skip(!process.env.ENTRY_MODE, '僅在 ENTRY_MODE=1（入口 stub 伺服器）下執行');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map();
    document.modelContext = {
      registerTool: async (tool, opts) => { tools.set(tool.name, tool); opts?.signal?.addEventListener('abort', () => tools.delete(tool.name)); },
      getTools: async () => [...tools.values()]
    };
  });
  await page.goto('/');
});

test('登入後顯示首次個資告知卡；按我知道了後消失，重載仍不再出現', async ({ page }) => {
  // 觸發假登入（stub-server 的 /oauth2/authorization/google 會把 member 設為 true 並 302 回首頁）
  await page.goto('/oauth2/authorization/google');
  await expect(page.locator('.privacy-notice')).toBeVisible();
  await expect(page.locator('#privacy-ack')).toBeVisible();
  await page.click('#privacy-ack');
  await expect(page.locator('.privacy-notice')).toHaveCount(0);
  // 重載：後端已記下 noticeAcked，不應再次出現
  await page.reload();
  await expect(page.locator('.privacy-notice')).toHaveCount(0);
  // 登出，還原 stub 伺服器狀態，避免影響同檔案內下一個 test
  await page.evaluate(async () => { await fetch('/logout', { method: 'POST' }); });
});

test('統計連結導向 #/stats 並在 stub 下正常渲染', async ({ page }) => {
  await page.click('#stats-link');
  await expect(page).toHaveURL(/#\/stats$/);
  await expect(page.locator('.stats')).toBeVisible();
});
