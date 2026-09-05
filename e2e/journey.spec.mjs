import { test, expect } from '@playwright/test';
// 用途：完整旅程——示範案例 → WAITING 作答 → COMPLETED → 圖有節點 → Inspector 執行 focusNode。
// 需要後端＋legal-mcp＋真 OPENAI_API_KEY；未設 E2E_LIVE=1 時整檔跳過。
test.skip(!process.env.E2E_LIVE, '需要 E2E_LIVE=1 與真 LLM');

test('car-accident sample completes with a graph and tools respond', async ({ page }) => {
  // 首頁已改為模式卡片，示範案例在案件模式輸入頁（#/case）
  await page.goto('/#/case');
  await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'en'); // 頁首已無語系選單，改由 app API 切換
  await page.click('[data-sample-id="car-accident"]');
  await expect(page.locator('.progress .step.active')).toBeVisible();
  // 等到 WAITING（示範案例刻意留白，必問）；澄清最多三輪，每輪答完按「繼續」，直到圖出現
  await page.waitForSelector('#questions-form', { timeout: 4 * 60_000 });
  for (let round = 1; round <= 3; round++) {
    const areas = page.locator('#questions-form textarea');
    const n = await areas.count();
    for (let i = 0; i < n; i++) await areas.nth(i).fill('Yes, there is dashcam footage showing the light was red.');
    await page.click('#questions-form button[type=submit]');
    // 送出後表單必須離開（進行中或換成下一輪新問題），不得停在同一份表單
    await expect(page.locator('#questions-form')).toBeHidden({ timeout: 15_000 });
    const next = await Promise.race([
      page.waitForSelector('#network-canvas canvas', { timeout: 6 * 60_000 }).then(() => 'graph'),
      page.waitForSelector('#questions-form', { timeout: 6 * 60_000 }).then(() => 'questions')
    ]);
    if (next === 'graph') break;
  }
  await page.waitForSelector('#network-canvas canvas', { timeout: 6 * 60_000 });
  await page.screenshot({ path: 'e2e/screenshots/completed-graph.png', fullPage: true });
  const summary = await page.evaluate(() => window.__graphView.summary());
  expect(summary.nodeCounts.fact).toBeGreaterThan(0);
  expect(summary.nodeCounts.law).toBeGreaterThan(0);
  // Inspector：執行 getGraphSummary 與 focusNode
  await page.click('#insp-toggle');
  await page.selectOption('#insp-tool', 'getGraphSummary');
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('nodeCounts');
  await page.selectOption('#insp-tool', 'focusNode');
  await page.fill('#insp-input', JSON.stringify({ label: '民法' }));
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('neighbors');
  await expect(page.locator('#detail-panel')).toHaveClass(/active/);
});

test('page works without WebMCP: badge and inspector are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#agent-badge')).toBeVisible();   // Playwright Chromium 無 WebMCP → unavailable
  await expect(page.locator('#inspector')).toBeVisible();
});
