import { test, expect } from '@playwright/test';
// 用途：今日配額已用完（/api/quota exhausted）時，輸入頁送出鈕即使字數達標也維持停用並附說明，
//       使用者不會送出後才收到 DAILY_CASE_LIMIT 錯誤。只需 stub server（node e2e/stub-server.mjs）。

/** 已用完配額的假回應。 */
const exhausted = { used: 1, limit: 1, remaining: 0, exhausted: true, memberLimit: 5, loggedIn: false, loginPath: '/oauth2/authorization/google' };
/** 仍有配額的假回應。 */
const available = { used: 0, limit: 1, remaining: 1, exhausted: false, memberLimit: 5, loggedIn: false };
// 文案斷言以 zh-TW 為準，語系由瀏覧器語言決定
test.use({ locale: 'zh-TW' });
const CASE_TEXT = '甲駕車進入市區十字路口後，與乙車發生碰撞，乙主張甲闖紅燈並請求醫療費與薪資損失。';

test('配額用完：橫幅提示且送出鈕鎖定', async ({ page }) => {
  await page.route('**/api/quota', (route) => route.fulfill({ json: exhausted }));
  await page.goto('/#/case');
  await expect(page.locator('.quota-banner')).toBeVisible();
  await page.fill('#case-text', CASE_TEXT);
  const submit = page.locator('#case-submit');
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('title', '今日分析次數已用完，明天再來。');
});

test('配額未用完：同樣輸入可送出', async ({ page }) => {
  await page.route('**/api/quota', (route) => route.fulfill({ json: available }));
  await page.goto('/#/case');
  await page.fill('#case-text', CASE_TEXT);
  await expect(page.locator('#case-submit')).toBeEnabled();
});
