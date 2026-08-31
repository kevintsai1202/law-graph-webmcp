import { test, expect } from '@playwright/test';
// 用途：不需 LLM 的前端煙霧測試——輸入頁、語系切換、以假 COMPLETED 狀態驗證結果頁、3D 圖、
//       Inspector 與 WebMCP 工具依頁面狀態同步（以假 modelContext 注入）。只需後端啟動（假金鑰亦可）。

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

/** 等待頁面初始化完成並公布指定 WebMCP 工具，涵蓋遠端主機較慢的 samples API。 */
const waitForTool = (page, name) => expect.poll(async () => page.evaluate((toolName) => {
  return document.modelContext.getTools().then((tools) => tools.some((tool) => tool.name === toolName));
}, name)).toBe(true);

test('input view lists four sample cards and switches locale', async ({ page }) => {
  await expect(page.locator('.sample')).toHaveCount(4);
  await expect(page.locator('#case-submit')).toHaveText('Analyse');
  await page.selectOption('#lang-select', 'zh-TW');
  await expect(page.locator('#case-submit')).toHaveText('開始分析');
  await expect(page.locator('h1')).toHaveText('法律關係圖');
  await expect(page.locator('#agent-badge')).toHaveText('Agent 工具：可用');
});

test('WebMCP startCase enters the progress view before a slow start response returns', async ({ page }) => {
  // 延遲啟動回應，驗證 WebMCP handler 不會讓畫面停在輸入頁等待後端。
  await page.route('**/api/cases', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ caseId: 'webmcp-slow-start', status: 'RUNNING', step: 'BRAINSTORM' })
    });
  });
  await waitForTool(page, 'startCase');

  const outcome = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === 'startCase');
    const execution = tool.execute({ caseText: 'A car accident happened at a city crossing.', locale: 'en' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const during = {
      view: window.__lawGraphApp.getState().view,
      hasProgress: Boolean(document.querySelector('.progress')),
      activeStep: document.querySelector('.progress .step.active')?.dataset.step
    };
    return { during, result: await execution };
  });

  expect(outcome.during).toEqual({ view: 'RUNNING', hasProgress: true, activeStep: 'BRAINSTORM' });
  expect(outcome.result).toMatchObject({ ok: true, caseId: 'webmcp-slow-start', status: 'RUNNING' });
});

test('WebMCP startCase accepts the visible sample title and stringified arguments', async ({ page }) => {
  // ChatGPT 可能傳入畫面標題，或由 host 將 JSON arguments 序列化成字串；兩者都應啟動同一頁面狀態。
  await page.route('**/api/cases', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ caseId: 'webmcp-title-start', status: 'RUNNING', step: 'BRAINSTORM' })
    });
  });
  await waitForTool(page, 'startCase');

  const outcome = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === 'startCase');
    const execution = tool.execute(JSON.stringify({ sampleId: 'Intersection traffic accident', locale: 'en' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      during: {
        view: window.__lawGraphApp.getState().view,
        activeStep: document.querySelector('.progress .step.active')?.dataset.step
      },
      result: await execution
    };
  });

  expect(outcome.during).toEqual({ view: 'RUNNING', activeStep: 'BRAINSTORM' });
  expect(outcome.result).toMatchObject({ ok: true, caseId: 'webmcp-title-start', status: 'RUNNING', step: 'BRAINSTORM' });
  await expect(page.locator('.progress')).toBeVisible();
});

test('每個頁面狀態的 WebMCP 工具與 Inspector 清單一致', async ({ page }) => {
  const stateTools = {
    INPUT: ['listSampleCases', 'startCase', 'verifyCitation'],
    RUNNING: ['getCaseStatus', 'resetCase'],
    QUESTIONS: ['getCaseStatus', 'getQuestions', 'fillQuestions', 'resetCase'],
    RESULT: ['getAnalysis', 'getCaseStatus', 'getGraphSummary', 'focusNode', 'filterGraph', 'explainEdge', 'resetCase', 'verifyCitation'],
    FAILED: ['getCaseStatus', 'resetCase']
  };
  const names = async () => (await page.evaluate(() => document.modelContext.getTools())).map((t) => t.name).sort();
  let answerRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/answers')) answerRequests++;
  });
  const inspectorNames = async () => page.locator('#insp-tool option').evaluateAll((options) => options.map((option) => option.value).sort());
  const expectState = async (view) => {
    const expected = [...stateTools[view]].sort();
    await expect.poll(async () => names()).toEqual(expected);
    await expect.poll(async () => inspectorNames()).toEqual(expected);
    await expect(page.locator('#insp-state')).toContainText(view);
    const listed = await page.locator('#insp-tools').textContent();
    for (const name of expected) expect(listed).toContain(name);
  };

  await expectState('INPUT');

  // RUNNING：案件啟動後只能查詢或由人明確放棄，不得再送第二個 sample。
  await page.evaluate(() => window.__lawGraphApp.dispatch({ type: 'START', caseId: 'smoke-running' }));
  await expectState('RUNNING');

  // QUESTIONS：先讀取題目對照，再讓 Agent 以 questionId 填入可見欄位。
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), waiting);
  await expectState('QUESTIONS');

  const questionGuide = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === 'getQuestions');
    return tool.execute({});
  });
  expect(questionGuide).toMatchObject({
    view: 'QUESTIONS',
    questions: [{ questionId: 'q1', question: 'When did the accident happen?', why: 'limitation period', filled: false }],
    fillQuestionsExample: { answers: [{ questionId: 'q1', answer: '' }] }
  });
  await page.click('#insp-toggle');
  await page.selectOption('#insp-tool', 'fillQuestions');
  await expect(page.locator('#insp-question-guide')).toContainText('When did the accident happen?');
  await expect.poll(async () => JSON.parse(await page.locator('#insp-input').inputValue())).toEqual({
    answers: [{ questionId: 'q1', answer: '' }]
  });

  // Agent 可把提議答案填入可見欄位，但不能跳過人的檢查與送出。
  const fillOutcome = await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    const fillTool = tools.find((candidate) => candidate.name === 'fillQuestions');
    const statusTool = tools.find((candidate) => candidate.name === 'getCaseStatus');
    const rejected = await fillTool.execute({ answers: [{ questionId: 'not-a-visible-question', answer: 'ignored' }] });
    const fill = await fillTool.execute(JSON.stringify({ answers: [{ questionId: 'q1', answer: '2026-08-01' }] }));
    return { rejected, fill, status: await statusTool.execute({}) };
  });
  expect(fillOutcome.rejected).toMatchObject({ ok: false, error: 'NO_ANSWERS_APPLIED' });
  expect(fillOutcome.fill).toMatchObject({ ok: true, submitted: false, humanReviewRequired: true, filledQuestionCount: 1 });
  expect(fillOutcome.status).toMatchObject({ view: 'QUESTIONS', status: 'WAITING', filledQuestionCount: 1, missingQuestionIds: [] });
  await expect(page.locator('#questions-form textarea[name="q1"]')).toHaveValue('2026-08-01');
  await expect(page.locator('#question-fill-notice')).toContainText('Agent filled');
  await expect(page.locator('#questions-form')).toBeVisible();
  expect(answerRequests).toBe(0);
  await expectState('QUESTIONS');

  // RESULT：才開放分析與圖操作工具。
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), completed);
  await expect(page.locator('#network-canvas')).toBeVisible();
  await expectState('RESULT');
  // 3D 圖：有 WebGL 時出現 canvas，否則出現錯誤橫幅（兩者皆屬明確狀態，不得空白）
  await expect(page.locator('#network-canvas canvas, #network-canvas div')).not.toHaveCount(0);
  const summary = await page.evaluate(() => window.__graphView.summary());
  expect(summary.nodeCounts).toEqual({ fact: 1, law: 1, issue: 1, element: 1 });
  expect(summary.unmetElements).toEqual(['Causation']);
  // 分頁：研究分頁列出驗證紀錄且已轉義
  await page.click('.tab[data-tab="research"]');
  await expect(page.locator('[data-panel="research"]')).toContainText('removed edge: x->y (unverified)');

  // FAILED：錯誤狀態不應重新暴露 startCase，避免 Agent 自動換案例。
  await page.evaluate(() => window.__lawGraphApp.dispatch({ type: 'STATUS', status: { caseId: 'smoke-failed', status: 'FAILED', step: 'BRAINSTORM', error: 'stub failure' } }));
  await expectState('FAILED');

  // 明確重置後才回到 INPUT，重新取得建立案件工具。
  await page.evaluate(() => window.__lawGraphApp.reset());
  await expect(page.locator('#case-submit')).toBeVisible();
  await expectState('INPUT');
});

/** 假的 WAITING 狀態：含頭腦風暴中間成果與一題提問。 */
const waiting = { caseId: 'smoke-2', status: 'WAITING', step: 'QUESTIONS', locale: 'en',
  questions: [{ id: 'q1', text: 'When did the accident happen?', why: 'limitation period' }],
  result: { brainstorm: { facts: ['A ran a red light'], relations: [], issues: ['Negligence'], evidenceNeeds: [], questions: [] } } };

test('waiting view shows brainstorm results above the questions, then collapses them after a few seconds', async ({ page }) => {
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), waiting);
  const partials = page.locator('.partials'), form = page.locator('#questions-form');
  await expect(partials).toBeVisible();
  await expect(partials.locator('details[data-section="brainstorm"]')).toHaveAttribute('open', '');
  // 成果區在 DOM 中位於表單之前
  const order = await page.evaluate(() => document.querySelector('.partials').compareDocumentPosition(document.querySelector('#questions-form')));
  expect(order & 4 /* DOCUMENT_POSITION_FOLLOWING */).toBeTruthy();
  await expect(form).toBeVisible();
  // 5 秒後自動收折，問題浮上來
  await expect(partials.locator('details[data-section="brainstorm"]')).not.toHaveAttribute('open', '', { timeout: 8000 });
});

test('waiting view offers a cancel button that returns to the input view', async ({ page }) => {
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), waiting);
  await expect(page.locator('#questions-form textarea[name="q1"]')).toBeVisible();
  // 放棄按鈕必須在表單之前（進度列下方），長問卷時不必捲到底才找得到
  const pos = await page.evaluate(() => document.querySelector('#cancel-case').compareDocumentPosition(document.querySelector('#questions-form')));
  expect(pos & 4 /* DOCUMENT_POSITION_FOLLOWING */).toBeTruthy();
  await expect(page.locator('#cancel-case')).toBeInViewport();
  await page.click('#cancel-case');
  await expect(page.locator('#case-submit')).toBeVisible();
  await expect(page.locator('#questions-form')).toHaveCount(0);
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
