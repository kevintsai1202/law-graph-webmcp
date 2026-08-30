import { test, expect } from '@playwright/test';
// 用途：不需 LLM 的前端煙霧測試——輸入頁、語系切換、以假 COMPLETED 狀態驗證結果頁、3D 圖、
//       Inspector 與 WebMCP 工具分階段註冊（以假 modelContext 注入）。只需後端啟動（假金鑰亦可）。

/** 假的 COMPLETED CaseStatus：涵蓋事實／法條／爭點／要件四種節點與三種邊。 */
const completed = {
  caseId: 'smoke-1', status: 'COMPLETED', step: 'GRAPH', locale: 'en',
  result: {
    brainstorm: { facts: ['A ran a red light and hit B'], relations: ['A owes B tort damages'], issues: ['Negligence'], evidenceNeeds: ['Dashcam'], questions: [] },
    research: { laws: [{ ref: '民法第184條', title: 'Civil Code Art. 184（民法第184條）', articleText: '', source: 'law.moj.gov.tw' }], judgments: [], notes: ['removed edge: x->y (unverified)'] },
    analysis: { elements: [{ law: '民法第184條', element: 'Causation', met: 'unknown', basis: 'No proof yet', fact: '' }], strategy: 'Secure the dashcam footage.', evidenceGaps: ['Dashcam'], disclaimer: 'Not legal advice.' },
    graph: {
      nodes: [
        { id: 'f1', group: 'fact', label: 'Red light collision', description: 'A ran a red light' },
        { id: 'l1', group: 'law', label: 'Civil Code Art. 184（民法第184條）', ref: '民法第184條' },
        { id: 'i1', group: 'issue', label: 'Negligence' },
        { id: 'e1', group: 'element', label: 'Causation', met: 'unknown' }],
      edges: [{ from: 'f1', to: 'l1', label: '適用' }, { from: 'l1', to: 'e1', label: '要件' }, { from: 'f1', to: 'e1', label: '該當' }]
    }
  }
};

test.beforeEach(async ({ page }) => {
  // 在頁面腳本執行前注入假的 document.modelContext，讓 registerTool 流程可被觀察
  await page.addInitScript(() => {
    const tools = new Map();
    document.modelContext = {
      registerTool: async (tool, opts) => { tools.set(tool.name, tool); opts?.signal?.addEventListener('abort', () => tools.delete(tool.name)); },
      getTools: async () => [...tools.values()]
    };
  });
  await page.goto('/');
});

test('input view lists four sample cards and switches locale', async ({ page }) => {
  await expect(page.locator('.sample')).toHaveCount(4);
  await expect(page.locator('#case-submit')).toHaveText('Analyse');
  await page.selectOption('#lang-select', 'zh-TW');
  await expect(page.locator('#case-submit')).toHaveText('開始分析');
  await expect(page.locator('h1')).toHaveText('法律關係圖');
  await expect(page.locator('#agent-badge')).toHaveText('Agent 工具：可用');
});

test('base tools register on load; graph tools only after COMPLETED; reset returns to five', async ({ page }) => {
  const names = async () => (await page.evaluate(() => document.modelContext.getTools())).map((t) => t.name).sort();
  expect(await names()).toEqual(['getCaseStatus', 'listSampleCases', 'resetCase', 'startCase', 'verifyCitation']);
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), completed);
  await expect(page.locator('#network-canvas')).toBeVisible();
  await expect.poll(async () => (await names()).length).toBe(10);
  // 3D 圖：有 WebGL 時出現 canvas，否則出現錯誤橫幅（兩者皆屬明確狀態，不得空白）
  await expect(page.locator('#network-canvas canvas, #network-canvas div')).not.toHaveCount(0);
  const summary = await page.evaluate(() => window.__graphView.summary());
  expect(summary.nodeCounts).toEqual({ fact: 1, law: 1, issue: 1, element: 1 });
  expect(summary.unmetElements).toEqual(['Causation']);
  // 分頁：研究分頁列出驗證紀錄且已轉義
  await page.click('.tab[data-tab="research"]');
  await expect(page.locator('[data-panel="research"]')).toContainText('removed edge: x->y (unverified)');
  // 回到輸入頁 → 只剩 5 個 base 工具
  await page.click('#new-case');
  await expect(page.locator('#case-submit')).toBeVisible();
  await expect.poll(async () => (await names()).length).toBe(5);
});

test('inspector runs getGraphSummary and focusNode against the rendered graph', async ({ page }) => {
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), completed);
  await expect(page.locator('#network-canvas')).toBeVisible();
  await page.click('#insp-toggle');
  await page.selectOption('#insp-tool', 'getGraphSummary');
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('nodeCounts');
  const hasCanvas = (await page.locator('#network-canvas canvas').count()) > 0;
  test.skip(!hasCanvas, 'WebGL 不可用，跳過 focusNode 鏡頭測試');
  await page.selectOption('#insp-tool', 'focusNode');
  await page.fill('#insp-input', JSON.stringify({ label: '民法' }));
  await page.click('#insp-run');
  await expect(page.locator('#insp-out')).toContainText('neighbors');
  await expect(page.locator('#detail-panel')).toHaveClass(/active/);
  await expect(page.locator('#detail-title')).toContainText('民法第184條');
  await page.screenshot({ path: 'e2e/screenshots/smoke-graph.png', fullPage: true });
});
