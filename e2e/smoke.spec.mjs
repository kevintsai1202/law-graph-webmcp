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

test('選單上有 Law Powers 技能常駐連結，切換語系後文字跟著變', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('#lawpowers-link');
  await expect(link).toHaveAttribute('href', 'https://kevintsai1202.github.io/law-powers/');
  await expect(link).toHaveAttribute('target', '_blank');
  await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'zh-TW'); // 頁首已無語系選單，改由 app API 切換
  await expect(link).toHaveText(/Law Powers 技能/);
  await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'en'); // 頁首已無語系選單，改由 app API 切換
  await expect(link).toHaveText(/Law Powers skills/);
});
test('input view lists six sample cards and switches locale', async ({ page }) => {
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
  await expect(page.locator('.sample')).toHaveCount(6);
  await expect(page.locator('#case-submit')).toHaveText('Analyse');
  await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'zh-TW'); // 頁首已無語系選單，改由 app API 切換
  await expect(page.locator('#case-submit')).toHaveText('開始分析');
  await expect(page.locator('h1')).toHaveText('法律關係圖');
  await expect(page.locator('#agent-badge')).toHaveText('Agent 工具：可用');
});

test('modern upload component shows file details and supports removal', async ({ page }) => {
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
  await page.evaluate((l) => window.__lawGraphApp.setLocale(l), 'zh-TW'); // 頁首已無語系選單，改由 app API 切換
  await expect(page.locator('#file-dropzone')).toContainText('將參考文件拖曳到這裡');

  await page.locator('#case-files').setInputFiles({
    name: '租賃契約.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('租賃契約與押金返還爭議')
  });
  await expect(page.locator('.file-item')).toHaveCount(1);
  await expect(page.locator('.file-name')).toHaveText('租賃契約.md');
  await expect(page.locator('.file-size')).toHaveText(/B$/);
  await expect(page.locator('#file-status')).toHaveText('已選擇 1 份檔案。');
  await expect(page.locator('#case-submit')).toBeEnabled();

  await page.locator('.file-remove').click();
  await expect(page.locator('.file-item')).toHaveCount(0);
  await expect(page.locator('#file-status')).toHaveText('尚未選擇檔案。');
  await expect(page.locator('#case-submit')).toBeDisabled();

  await page.locator('#file-dropzone').evaluate((dropzone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['PDF test content'], '裁判書.pdf', { type: 'application/pdf', lastModified: 1 }));
    dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
    dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.locator('.file-name')).toHaveText('裁判書.pdf');
  await expect(page.locator('#file-status')).toHaveText('已選擇 1 份檔案。');
  await expect(page.locator('#case-submit')).toBeEnabled();
});

test('WebMCP startCase enters the progress view before a slow start response returns', async ({ page }) => {
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
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
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
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

test('WebMCP setOutputSelection ticks visible output checkboxes without starting the case', async ({ page }) => {
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
  await waitForTool(page, 'setOutputSelection');
  const outcome = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === 'setOutputSelection');
    return tool.execute({ outputs: ['issues', 'complaint'] });
  });
  expect(outcome).toMatchObject({ ok: true, submitted: false, humanReviewRequired: true, applied: ['complaint', 'issues'] });
  await expect(page.locator('input[name="outputs"][value="complaint"]')).toBeChecked();
  await expect(page.locator('input[name="outputs"][value="issues"]')).toBeChecked();
  await expect(page.locator('input[name="outputs"][value="graph"]')).not.toBeChecked();
  // 只代勾不代送：案情未達最少字數，送出鈕仍停用、頁面仍在輸入頁
  await expect(page.locator('#case-submit')).toBeDisabled();
  await expect(page.locator('.progress')).toHaveCount(0);
});

test('WebMCP 工具在 <head> 的 webmcp-bundle.js 載入時即註冊，早於應用層 app-bundle.js', async ({ page }) => {
  // 以 init script 記錄每次 registerTool 當下 window.__lawGraphApp 是否已存在
  await page.addInitScript(() => {
    const original = document.modelContext.registerTool;
    window.__registrationLog = [];
    document.modelContext.registerTool = async (tool, opts) => {
      window.__registrationLog.push({ name: tool.name, appLoaded: Boolean(window.__lawGraphApp) });
      return original(tool, opts);
    };
  });
  // hash-only 導覽不會讓瀏覽器重新載入文件，addInitScript 就不會套用；
  // 先跳到空白頁再導向 #/case，確保是真正的新導覽（頁面一開始就在案件輸入頁）
  await page.goto('about:blank');
  await page.goto('/#/case');
  await waitForTool(page, 'startCase');
  const log = await page.evaluate(() => window.__registrationLog);
  const first = log.find((entry) => entry.name === 'startCase');
  expect(first.appLoaded).toBe(false);
  // 早期註冊的工具在 app 綁定後可正常執行
  const samples = await page.evaluate(async () => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === 'listSampleCases');
    return tool.execute({});
  });
  expect(samples.length).toBe(6);
});

test('WebMCP getOutputOptions／getInputForm 回報輸入頁可見內容：9 個可勾輸出、字數與送出狀態', async ({ page }) => {
  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
  await waitForTool(page, 'getOutputOptions');
  const call = (name, input = {}) => page.evaluate(async ([toolName, args]) => {
    const tool = (await document.modelContext.getTools()).find((candidate) => candidate.name === toolName);
    return tool.execute(args);
  }, [name, input]);
  const options = await call('getOutputOptions');
  expect(options).toMatchObject({ ok: true, rendered: true, count: 9, checkedCount: 1, minRequired: 1 });
  expect(options.options.filter((o) => o.checked).map((o) => o.code)).toEqual(['graph']);
  expect(options.options.map((o) => o.code)).toEqual(['graph', 'complaint', 'reasons', 'report', 'preparatory', 'defense', 'issues', 'appeal', 'motion']);
  expect(options.options[1].label).toContain('起訴狀');
  // 代勾後再讀，數量要跟畫面一致
  await call('setOutputSelection', { outputs: ['graph', 'issues'] });
  expect((await call('getOutputOptions')).checkedCount).toBe(2);
  // 輸入頁全貌：尚未輸入案情，送出鈕停用
  const form = await call('getInputForm');
  expect(form).toMatchObject({ ok: true, charCount: 0, minChars: 20, canSubmit: false, sampleCount: 6 }); // 示範案例已從 4 筆擴充為 6 筆
  await page.fill('#case-text', 'A ran a red light and crashed into B, who now claims damages.');
  const filled = await call('getInputForm');
  expect(filled.canSubmit).toBe(true);
  expect(filled.charCount).toBeGreaterThanOrEqual(20);
  expect(filled.outputs.checkedCount).toBe(2);
});

test('每個頁面狀態的 WebMCP 工具與 Inspector 清單一致', async ({ page }) => {
  const stateTools = {
    INPUT: ['listSampleCases', 'startCase', 'setOutputSelection', 'getOutputOptions', 'getInputForm', 'verifyCitation', 'listCapabilities', 'selectCapability', 'startContractReview', 'getUsageStats'],
    RUNNING: ['getCaseStatus', 'resetCase'],
    QUESTIONS: ['getCaseStatus', 'getQuestions', 'fillQuestions', 'resetCase'],
    RESULT: ['getAnalysis', 'getCaseStatus', 'getResultTabs', 'getGraphSummary', 'focusNode', 'filterGraph', 'explainEdge', 'resetCase', 'verifyCitation', 'getComplianceReport', 'filterFindingsByRisk', 'getUsageStats'],
    FAILED: ['getCaseStatus', 'resetCase']
  };
  const names = async () => (await page.evaluate(() => document.modelContext.getTools())).map((t) => t.name).sort();
  let answerRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/answers')) answerRequests++;
  });
  // Inspector 已唯讀：清單改為 #insp-list 的 <code> 工具名
  const inspectorNames = async () => page.locator('#insp-list li code').evaluateAll((codes) => codes.map((code) => code.textContent).sort());
  const expectState = async (view) => {
    const expected = [...stateTools[view]].sort();
    await expect.poll(async () => names()).toEqual(expected);
    await expect.poll(async () => inspectorNames()).toEqual(expected);
    await expect(page.locator('#insp-state')).toContainText(view);
  };

  await page.goto('/#/case'); // 首頁現為能力入口，案件輸入頁改走 hash 路由
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
  // Inspector 唯讀：QUESTIONS 狀態也不提供任何執行或填答 UI
  await page.click('#insp-toggle');
  await expect(page.locator('#insp-list')).toContainText('fillQuestions');
  await expect(page.locator('#insp-run, #insp-tool, #insp-input')).toHaveCount(0);

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

  // 明確重置後回到首頁（能力入口），需再次選擇案件分析才回到 INPUT、重新取得建立案件工具。
  await page.evaluate(() => window.__lawGraphApp.reset());
  await expect(page.locator('.capability')).toHaveCount(2);
  await page.goto('/#/case');
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
  // 放棄後回到首頁（能力入口），不再直接停在案件輸入頁
  await expect(page.locator('.capability')).toHaveCount(2);
  await expect(page.locator('#questions-form')).toHaveCount(0);
});

test('inspector is read-only: shows state and tool list, no run controls; tools still work via WebMCP layer', async ({ page }) => {
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), completed);
  await expect(page.locator('#network-canvas')).toBeVisible();
  await page.click('#insp-toggle');
  // 唯讀：只顯示頁面狀態與可用工具清單，不提供直接執行
  await expect(page.locator('#insp-state')).toContainText('RESULT');
  await expect(page.locator('#insp-list li')).toHaveCount(12);
  await expect(page.locator('#insp-list')).toContainText('getGraphSummary');
  await expect(page.locator('#insp-run')).toHaveCount(0);
  await expect(page.locator('#insp-tool')).toHaveCount(0);
  await expect(page.locator('#insp-input')).toHaveCount(0);
  // 工具本身仍可由 Agent 經 WebMCP 層執行（E2E 走 window.__webmcp）
  const summary = await page.evaluate(() => window.__webmcp.execute('getGraphSummary', {}));
  expect(summary).toHaveProperty('nodeCounts');
  const hasCanvas = (await page.locator('#network-canvas canvas').count()) > 0;
  test.skip(!hasCanvas, 'WebGL 不可用，跳過 focusNode 鏡頭測試');
  const focus = await page.evaluate(() => window.__webmcp.execute('focusNode', { label: '民法' }));
  expect(focus).toHaveProperty('neighbors');
  await expect(page.locator('#detail-panel')).toHaveClass(/active/);
  await expect(page.locator('#detail-title')).toContainText('民法第184條');
  await page.screenshot({ path: 'e2e/screenshots/smoke-graph.png', fullPage: true });
});

// 首頁雙入口：兩張能力卡片，點合約審查可進入合約輸入頁並看到示範合約；切回案件輸入頁仍是 6 筆
test('首頁顯示兩張能力卡片；點合約審查進入合約輸入頁並可看示範合約', async ({ page }) => {
  await expect(page.locator('.capability')).toHaveCount(2);
  await page.locator('.capability[data-mode="contract"] button').click();
  await expect(page).toHaveURL(/#\/contract$/);
  await expect(page.locator('input[name="party"]')).toHaveCount(3);
  await expect(page.locator('.sample')).toHaveCount(2);
  await page.goto('/#/case');
  await expect(page.locator('.sample')).toHaveCount(6);
});

// 合約結果頁：COMPLETED 狀態下顯示風險條款清單，可依風險篩選，摘要分頁顯示優先建議
test('合約 COMPLETED 狀態顯示風險條款清單與篩選', async ({ page }) => {
  await page.goto('/#/contract');
  await page.evaluate((s) => window.__lawGraphApp.dispatch({ type: 'STATUS', status: s }), {
    caseId: 'c1', status: 'COMPLETED', step: 'SUMMARY', locale: 'zh-TW', mode: 'contract',
    result: { contract: { contractType: '勞動契約', clauses: [] }, research: { laws: [], judgments: [], notes: [] },
      compliance: { contractType: '勞動契約', scopes: ['labor'], overallRisk: 'high', priorities: ['先改第二條'], disclaimer: 'x',
        findings: [{ clauseNo: '第二條', clauseText: '不發加班費', risk: 'high', lawRefs: [], riskPoint: 'r', suggestion: 's', judgmentCitations: [] },
                   { clauseNo: '第五條', clauseText: '調動', risk: 'low', lawRefs: [], riskPoint: 'r', suggestion: 's', judgmentCitations: [] }] },
      graph: { nodes: [{ id: 'c', group: 'contract', label: '勞動契約' }, { id: 'cl', group: 'clause', label: '第二條', risk: 'high' }],
        edges: [{ from: 'c', to: 'cl', label: '包含' }] } } });
  await expect(page.locator('[data-tab="findings"]')).toBeVisible();
  // 加了 graph 後預設分頁會落在 graph，先切回 findings 面板才能點篩選按鈕
  await page.locator('[data-tab="findings"]').click();
  await expect(page.locator('tr[data-risk]')).toHaveCount(2);
  await page.locator('#findings-filter [data-risk="high"]').click();
  await expect(page.locator('tr[data-risk]')).toHaveCount(1);
  await page.locator('[data-tab="summary"]').click();
  await expect(page.locator('#panel-summary')).toContainText('先改第二條');
  // 合約圖分頁：契約→條款圖已回傳，分頁應存在（不點擊，3D 圖資產較重）
  await expect(page.locator('[data-tab="graph"]')).toBeVisible();
});

// HOME：能力入口頁應同時公布切換能力與啟動合約審查的 WebMCP 工具
test('HOME 狀態下 WebMCP 工具清單含 selectCapability 與 startContractReview', async ({ page }) => {
  await page.goto('/');
  await waitForTool(page, 'selectCapability');
  await waitForTool(page, 'startContractReview');
  const names = (await page.evaluate(() => document.modelContext.getTools())).map((t) => t.name);
  expect(names).toContain('selectCapability');
  expect(names).toContain('startContractReview');
});
