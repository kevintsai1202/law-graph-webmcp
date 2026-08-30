import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
// 用途：教學影片素材——走完整旅程並在每個動作後截圖，輸出到 docs/tutorial/<locale>/NN-*.png
//       （不放在 e2e/screenshots，因為 Playwright 每次執行會清空 outputDir）。
//       需要後端＋legal-mcp＋真 OPENAI_API_KEY；未設 E2E_LIVE=1 時整檔跳過。
//       執行：$env:E2E_LIVE='1'; npx playwright test -c e2e/playwright.config.mjs e2e/tutorial.spec.mjs
test.skip(!process.env.E2E_LIVE, '需要 E2E_LIVE=1 與真 LLM');
test.use({ viewport: { width: 1440, height: 900 } });

/** 兩語系的固定回答與 focus 關鍵字。 */
const L10N = {
  en: { answer: 'Yes, there is dashcam footage showing the light was red. The crash happened on 2025-03-12 at 08:15.', focus: 'Civil Code' },
  'zh-TW': { answer: '有，行車紀錄器影像顯示對方闖紅燈。事故發生於 2025 年 3 月 12 日上午 8 時 15 分。', focus: '民法' }
};

for (const locale of ['en', 'zh-TW']) {
  test(`tutorial screenshots (${locale})`, async ({ page }) => {
    const dir = `docs/tutorial/${locale}`;
    mkdirSync(dir, { recursive: true });
    let n = 0;
    /** 逐步截圖：兩位數序號＋名稱，方便剪輯時排序。 */
    const shot = async (name) => { n += 1; await page.screenshot({ path: `${dir}/${String(n).padStart(2, '0')}-${name}.png`, fullPage: false }); };
    const x = L10N[locale];

    // 1. 輸入頁與語系
    await page.goto('/');
    await page.selectOption('#lang-select', locale);
    await expect(page.locator('.sample')).toHaveCount(4);
    await shot('input-view');

    // 2–3. 點示範案例 → 提問 → 填答 → 完成。模型偶爾不提問、或圖過小（法條被硬規則剔除），
    //       教學畫面需要完整流程，因此以「有提問且節點 ≥ 8」為合格條件，最多重試 3 次。
    let ok = false;
    const nStart = n;   // 重試時序號回到此處，讓新一輪截圖覆蓋舊檔
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      n = nStart;
      await page.click('[data-sample-id="car-accident"]');
      await expect(page.locator('.progress .step.active')).toBeVisible();
      await shot('progress-brainstorm');
      // 頭腦風暴一結束（中間成果或提問出現）即截「進行中＋目前成果」畫面
      await page.waitForSelector('.partials, #questions-form, #network-canvas canvas', { timeout: 4 * 60_000 });
      if (await page.locator('.partials').count()) await shot('progress-with-partial-results');
      await page.waitForSelector('#questions-form, #network-canvas canvas', { timeout: 4 * 60_000 });
      const asked = (await page.locator('#questions-form').count()) > 0;
      if (asked) {
        await shot('questions-empty');
        const areas = page.locator('#questions-form textarea');
        const count = await areas.count();
        for (let i = 0; i < count; i++) await areas.nth(i).fill(x.answer);
        await shot('questions-answered');
        await page.click('#questions-form button[type=submit]');
        await expect(page.locator('.progress .step.active')).toBeVisible();
        await shot('progress-research');
      }
      await page.waitForSelector('#network-canvas canvas', { timeout: 6 * 60_000 });
      const nodeCount = await page.evaluate(() => window.__lawGraphApp.getState().last.result.graph.nodes.length);
      ok = asked && nodeCount >= 8;
      if (!ok) {
        console.log(`[${locale}] 第 ${attempt} 次不合格（asked=${asked}, nodes=${nodeCount}）${attempt < 3 ? '，重試' : '，採用本次結果'}`);
        if (attempt < 3) { await page.click('#new-case'); await expect(page.locator('#case-submit')).toBeVisible(); }
      }
    }

    // 4. 完成 → 3D 圖（已於迴圈內完成等待）
    await page.waitForTimeout(2500);   // 讓力導向佈局收斂並自動框圖
    await shot('result-graph');

    // 5. 四個分頁
    for (const tab of ['analysis', 'research', 'brainstorm']) {
      await page.click(`.tab[data-tab="${tab}"]`);
      await expect(page.locator(`[data-panel="${tab}"]`)).toBeVisible();
      await shot(`result-${tab}`);
    }
    await page.click('.tab[data-tab="graph"]');
    await page.waitForSelector('#network-canvas canvas');
    await page.waitForTimeout(2000);

    // 6. Inspector：逐一執行圖工具
    const run = async (tool, input, expectText) => {
      await page.selectOption('#insp-tool', tool);
      await page.fill('#insp-input', JSON.stringify(input));
      await page.click('#insp-run');
      await expect(page.locator('#insp-out')).toContainText(expectText, { timeout: 15_000 });
      await shot(`inspector-${tool}`);
    };
    await page.click('#insp-toggle');
    await shot('inspector-open');
    await run('getCaseStatus', {}, 'COMPLETED');
    await run('getGraphSummary', {}, 'nodeCounts');
    await run('getAnalysis', { section: 'analysis' }, 'elements');
    // 以圖上真的存在的節點聚焦：優先法條節點（含 focus 關鍵字者更佳），否則第一個節點，避免模型命名差異造成 not found
    const nodes = await page.evaluate(() => window.__lawGraphApp.getState().last.result.graph.nodes);
    const target = nodes.find((n) => n.group === 'law' && n.label.includes(x.focus)) || nodes.find((n) => n.group === 'law') || nodes[0];
    await run('focusNode', { nodeId: target.id }, 'neighbors');
    await expect(page.locator('#detail-panel')).toHaveClass(/active/);
    await shot('focus-detail-panel');
    await run('filterGraph', { groups: ['law', 'element'] }, 'visibleNodes');
    await run('filterGraph', { reset: true }, 'visibleNodes');
    await run('verifyCitation', { ref: '民法第184條' }, 'exists');

    // 7. 詳情面板關閉、新案件
    await page.click('#close-panel-btn');
    await page.click('#insp-toggle');
    await shot('result-graph-clean');
    await page.click('#new-case');
    await expect(page.locator('#case-submit')).toBeVisible();
    await shot('back-to-input');
  });
}
