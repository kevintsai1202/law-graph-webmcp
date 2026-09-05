import { test, expect } from '@playwright/test';
// 用途：研究結果回報語意檢索授權失效（coverage.authorizationRequired）時，
//       前端只顯示提示橫幅與授權連結，不得整頁導向第三方授權站、網址不變。
//       只需 stub server（node e2e/stub-server.mjs）；案件狀態由本檔 route 假造。

/** 進行中案件：研究步驤已完成但語意軌 AUTH 失效。 */
const running = {
  caseId: 'auth-1', status: 'RUNNING', step: 'ANALYSIS', locale: 'zh-TW',
  result: { research: { laws: [{ ref: '民法第184條', title: '民法', articleText: '', source: '' }], judgments: [], notes: ['semantic track unavailable (AUTH)'],
    coverage: { keywordStatus: 'SUCCESS', semanticStatus: 'UNAVAILABLE', authorizationRequired: true } } }
};

test.use({ locale: 'zh-TW' });

test('authorizationRequired 只顯示橫幅，不導向、網址不變', async ({ page }) => {
  await page.route('**/api/cases/auth-1', (route) => route.fulfill({ json: running }));
  // 後端目前未授權，橫幅才該出現
  await page.route('**/api/auth/tw-legal-rag/status', (route) => route.fulfill({ json: { enabled: true, authorized: false, authorizationRequired: true, startPath: '/api/auth/tw-legal-rag/start' } }));
  await page.addInitScript(() => { sessionStorage.setItem('caseId', 'auth-1'); sessionStorage.setItem('mode', 'case'); sessionStorage.setItem('outputs', '["graph"]'); });
  const navigations = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations.push(f.url()); });
  await page.goto('/');
  const banner = page.locator('#stage .semantic-auth-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('語意檢索：未授權');
  await expect(banner.locator('a.auth-link')).toHaveAttribute('href', /\/api\/auth\/tw-legal-rag\/start\?returnTo=/);
  await page.waitForTimeout(3000);
  // 只有最初 goto 的一次導航，且仍停在本站
  expect(navigations.filter((u) => !u.includes('#')).length + navigations.filter((u) => u.includes('#')).length).toBeLessThanOrEqual(2);
  expect(page.url()).toMatch(/^http:\/\/localhost:\d+\/(#\/case)?$/);
  await expect(page.locator('.progress .step.active')).toBeVisible();
});

test('後端已重新授權時不顯示橫幅', async ({ page }) => {
  await page.route('**/api/cases/auth-1', (route) => route.fulfill({ json: running }));
  await page.route('**/api/auth/tw-legal-rag/status', (route) => route.fulfill({ json: { enabled: true, authorized: true, authorizationRequired: false, startPath: '/api/auth/tw-legal-rag/start' } }));
  await page.addInitScript(() => { sessionStorage.setItem('caseId', 'auth-1'); sessionStorage.setItem('mode', 'case'); sessionStorage.setItem('outputs', '["graph"]'); });
  await page.goto('/');
  await expect(page.locator('.progress .step.active')).toBeVisible();
  await expect(page.locator('#stage .semantic-auth-banner')).toHaveCount(0);
});
