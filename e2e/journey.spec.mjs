import{test,expect}from'@playwright/test';test.skip(!process.env.E2E_LIVE,'需要真 LLM 與 legal-mcp');
/** 完整人機旅程：案例、提問、回答、完成圖與 Inspector。 */
test('car accident completes',async({page})=>{await page.goto('/');await page.click('[data-id="car-accident"]');await page.waitForSelector('#questions:not([hidden])',{timeout:240000});for(const x of await page.locator('#questions textarea').all())await x.fill('Unknown; use the conservative assumption.');await page.click('#questions form button');await page.waitForSelector('#result:not([hidden])',{timeout:360000});await expect(page.locator('#graph .node').first()).toBeVisible();});
/** 無 WebMCP 的 Chromium 仍提供 Inspector。 */
test('fallback inspector exists',async({page})=>{await page.goto('/');await expect(page.locator('#inspector')).toBeVisible();});
