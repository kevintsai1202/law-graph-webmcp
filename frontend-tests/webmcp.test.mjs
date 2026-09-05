import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFS, TOOL_NAMES_BY_VIEW, truncate, createWebMcp, resolveModelContext } from '../src/main/resources/static/js/webmcp.js';

// 用途：WebMCP 十二工具契約、狀態矩陣（名稱／描述長度、annotations、無自動送出工具）與 1500 字元護欄。
test('二十二個工具，名稱/描述長度符合 Chrome 安全預算', () => {
  assert.equal(TOOL_DEFS.length, 22);
  for (const d of TOOL_DEFS) {
    assert.ok(d.name.length <= 30, d.name);
    assert.ok(d.description.length <= 150, d.name);
    assert.equal(d.inputSchema.type, 'object');
    assert.equal(d.inputSchema.additionalProperties, false, d.name);
    assert.ok(['base', 'questions', 'completed'].includes(d.phase));
  }
  assert.ok(!TOOL_DEFS.some((d) => /answer/i.test(d.name)), '不得有代答工具');
  const names = new Set(TOOL_DEFS.map((d) => d.name));
  for (const [view, tools] of Object.entries(TOOL_NAMES_BY_VIEW)) {
    assert.ok(tools.length > 0, view);
    for (const name of tools) assert.ok(names.has(name), `${view}: ${name}`);
  }
  assert.ok(TOOL_NAMES_BY_VIEW.QUESTIONS.includes('fillQuestions'), 'QUESTIONS 應可填入答案');
  assert.ok(TOOL_NAMES_BY_VIEW.QUESTIONS.includes('getQuestions'), 'QUESTIONS 應可讀取題目格式');
  assert.ok(!TOOL_NAMES_BY_VIEW.QUESTIONS.includes('startCase'), 'QUESTIONS 不得再啟動其他案件');
  // getUsageStats（M3 接上 /api/stats）：唯讀彙總統計，於 HOME／INPUT／RESULT 曝光
  assert.ok(names.has('getUsageStats'), 'getUsageStats 仍保留在 TOOL_DEFS');
  for (const view of ['HOME', 'INPUT', 'RESULT']) {
    assert.ok(TOOL_NAMES_BY_VIEW[view].includes('getUsageStats'), `${view} 應曝光 getUsageStats`);
  }
  for (const view of ['RUNNING', 'QUESTIONS', 'FAILED']) {
    assert.ok(!TOOL_NAMES_BY_VIEW[view].includes('getUsageStats'), `${view} 流程進行中不曝光 getUsageStats`);
  }
});
test('唯讀工具帶 readOnlyHint；getAnalysis 帶 untrustedContentHint', () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.equal(byName.getCaseStatus.annotations.readOnlyHint, true);
  assert.equal(byName.getAnalysis.annotations.untrustedContentHint, true);
  assert.equal(byName.startCase.annotations?.readOnlyHint, undefined);
  assert.equal(byName.fillQuestions.annotations?.readOnlyHint, undefined);
  assert.match(byName.fillQuestions.description, /Does not submit/);
});
test('truncate 超過 1500 字元回摘要', () => {
  const r = truncate({ text: 'x'.repeat(2000) });
  assert.equal(r.truncated, true); assert.ok(JSON.stringify(r).length <= 1500);
  assert.deepEqual(truncate({ a: 1 }), { a: 1 });
});
test('WebMCP runtime 兼容 Chrome 149 navigator 與新版 document 介面', () => {
  const legacy = { navigator: { modelContext: { version: 'legacy' } }, document: {} };
  const modern = { navigator: { modelContext: { version: 'legacy' } }, document: { modelContext: { version: 'modern' } } };
  assert.equal(resolveModelContext(legacy), legacy.navigator.modelContext);
  assert.equal(resolveModelContext(modern), modern.document.modelContext);
  assert.equal(resolveModelContext({ document: {}, navigator: {} }), undefined);
});
test('每個頁面狀態只註冊該狀態工具，切換狀態會 abort 舊清單', async () => {
  const active = new Map(); let aborted = 0;
  const appState = { view: 'INPUT' };
  const fakeContext = {
    registerTool: async (tool, opts) => {
      active.set(tool.name, tool);
      opts.signal.addEventListener('abort', () => { aborted++; active.delete(tool.name); });
    }
  };
  const app = { getState: () => appState, getLocale: () => 'en' };
  const w = createWebMcp({ app, graphView: {}, modelContext: fakeContext });
  for (const [view, expected] of Object.entries(TOOL_NAMES_BY_VIEW)) {
    appState.view = view;
    await w.syncForState(view);
    assert.deepEqual([...active.keys()].sort(), [...expected].sort(), view);
    assert.deepEqual([...w.tools()].sort(), [...expected].sort(), `recorded ${view}`);
  }
  // 每次切換解除前一批工具；最後一批由 unregisterAll 解除
  const sizes = Object.values(TOOL_NAMES_BY_VIEW).map((tools) => tools.length);
  const beforeCleanup = sizes.slice(0, -1).reduce((a, b) => a + b, 0);
  assert.equal(aborted, beforeCleanup, '每次真正切換都應解除上一批工具');
  w.unregisterAll();
  assert.equal(aborted, beforeCleanup + sizes[sizes.length - 1], '清理時應解除最後一批工具');
  assert.equal(active.size, 0);
  assert.equal(w.tools().length, 0);
});
test('無 WebMCP 環境時仍記錄各狀態可用工具，供 Inspector 顯示', async () => {
  const appState = { view: 'INPUT' };
  const w = createWebMcp({ app: { getState: () => appState, getLocale: () => 'en' }, graphView: {}, modelContext: undefined });
  for (const [view, expected] of Object.entries(TOOL_NAMES_BY_VIEW)) {
    appState.view = view;
    await w.syncForState(view);
    assert.deepEqual([...w.tools()].sort(), [...expected].sort(), view);
  }
  w.unregisterAll(); assert.equal(w.tools().length, 0);
});
test('狀態切換後舊 host callback 不能再啟動另一個案件', async () => {
  const appState = { view: 'INPUT' };
  const active = new Map();
  const w = createWebMcp({
    app: { getState: () => appState, getLocale: () => 'en' },
    graphView: {},
    modelContext: { registerTool: async (tool) => active.set(tool.name, tool) }
  });
  await w.syncForState('INPUT');
  const staleStart = active.get('startCase');
  appState.view = 'QUESTIONS';
  const refused = await staleStart.execute({ caseText: 'x'.repeat(30) });
  assert.equal(refused.error, 'TOOL_UNAVAILABLE');
  assert.equal(refused.current.view, 'QUESTIONS');
  assert.match(refused.nextAction, /do not call startCase/i);
});
test('startCase 於案件進行中拒絕；getCaseStatus 不夾帶 result 全文', async () => {
  const app = {
    getState: () => ({ view: 'QUESTIONS', caseId: 'p1', last: {
      caseId: 'p1', status: 'WAITING', step: 'QUESTIONS',
      questions: [{ id: 'q1', text: 'When?', why: 'timing' }], result: { brainstorm: {} }
    } }),
    getQuestionProgress: () => ({ filledQuestionCount: 1, questionCount: 1, missingQuestionIds: [] }),
    getLocale: () => 'en'
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const refused = await w.execute('startCase', { caseText: 'x'.repeat(30) });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'CASE_IN_PROGRESS');
  assert.equal(refused.current.status, 'WAITING');
  assert.equal(refused.current.humanActionRequired, true);
  assert.match(refused.nextAction, /human/);
  const status = await w.execute('getCaseStatus', {});
  assert.equal(status.status, 'WAITING');
  assert.equal(status.view, 'QUESTIONS');
  assert.equal(status.questionCount, 1);
  assert.equal(status.filledQuestionCount, 1);
  assert.deepEqual(status.missingQuestionIds, []);
  assert.match(status.nextAction, /review/i);
  assert.equal(status.humanActionRequired, true);
  assert.equal(status.result, undefined);
  const questions = await w.execute('getQuestions', {});
  assert.equal(questions.view, 'QUESTIONS');
  assert.deepEqual(questions.questions, [{ questionId: 'q1', question: 'When?', why: 'timing', filled: true }]);
  assert.deepEqual(questions.fillQuestionsExample, { answers: [{ questionId: 'q1', answer: '' }] });
});
test('startCase 契約含 documents 勾選參數並轉交 app.start', async () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  const docs = byName.startCase.inputSchema.properties.documents;
  assert.equal(docs.type, 'array');
  assert.ok(docs.items.enum.includes('complaint'));
  assert.ok(docs.items.enum.includes('motion'));
  assert.equal(docs.items.enum.length, 8);
  assert.ok(byName.getAnalysis.inputSchema.properties.section.enum.includes('documents'),
    '完成後 Agent 應可讀取已起草書狀');
  const calls = [];
  const app = {
    getState: () => ({ view: 'INPUT' }),
    getLocale: () => 'en',
    start: async (text, outputs) => { calls.push([text, outputs]); return { caseId: 'p1', status: 'RUNNING', step: 'BRAINSTORM' }; }
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('startCase', { caseText: 'x'.repeat(30), documents: ['complaint'] });
  assert.equal(r.ok, true);
  assert.deepEqual(calls[0][1], ['graph', 'complaint'], 'Agent 啟動時關聯圖仍預設包含');
});
test('watchModelContext：host 晚注入 modelContext 時仍會偵測到並只回呼一次', async () => {
  const runtime = { document: {}, navigator: {} };
  const found = [];
  const { watchModelContext } = await import('../src/main/resources/static/js/webmcp.js');
  watchModelContext(runtime, (mc) => found.push(mc), { intervalMs: 5, timeoutMs: 200 });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(found.length, 0, '尚未注入前不得回呼');
  runtime.document.modelContext = { registerTool: async () => {} };
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(found.length, 1);
  assert.equal(found[0], runtime.document.modelContext);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(found.length, 1, '偵測到之後應停止輪詢，不得重複回呼');
});
test('attachModelContext：晚接上的 host 會補註冊目前狀態的工具', async () => {
  const active = new Map();
  const appState = { view: 'INPUT' };
  const w = createWebMcp({ app: { getState: () => appState, getLocale: () => 'en' }, graphView: {}, modelContext: undefined });
  await w.syncForState('INPUT');
  assert.equal(active.size, 0, '尚未有 host 前不會真正註冊');
  const late = { registerTool: async (tool, opts) => { active.set(tool.name, tool); opts.signal.addEventListener('abort', () => active.delete(tool.name)); } };
  await w.attachModelContext(late);
  assert.deepEqual([...active.keys()].sort(), [...TOOL_NAMES_BY_VIEW.INPUT].sort());
});
test('setOutputSelection：INPUT 限定，代勾可見輸出勾選框但不送出', async () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  const schema = byName.setOutputSelection.inputSchema.properties.outputs;
  assert.equal(schema.type, 'array');
  assert.ok(schema.items.enum.includes('graph'), '關聯圖也是可勾選項目');
  assert.equal(schema.items.enum.length, 9);
  assert.ok(TOOL_NAMES_BY_VIEW.INPUT.includes('setOutputSelection'));
  assert.ok(!TOOL_NAMES_BY_VIEW.RESULT.includes('setOutputSelection'), '只在輸入頁提供');
  const calls = [];
  const appState = { view: 'INPUT' };
  const app = {
    getState: () => appState,
    getLocale: () => 'en',
    setOutputs: (outputs) => { calls.push(outputs); return { ok: true, submitted: false, applied: ['graph', 'complaint'] }; }
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('setOutputSelection', { outputs: ['complaint', 'graph'] });
  assert.equal(r.ok, true);
  assert.equal(r.submitted, false);
  assert.deepEqual(calls[0], ['complaint', 'graph']);
  // 非 INPUT 狀態拒絕
  appState.view = 'RESULT';
  appState.last = { status: 'COMPLETED' };
  const refused = await w.execute('setOutputSelection', { outputs: ['graph'] });
  assert.equal(refused.error, 'TOOL_UNAVAILABLE');
});

// 用途：頁面上可見內容都有對應讀取工具——輸出勾選區（幾項可勾／已勾）、輸入頁全貌、結果頁分頁。
test('getOutputOptions／getInputForm 只在 INPUT 提供，轉交 app 讀取可見內容', async () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.equal(byName.getOutputOptions.annotations.readOnlyHint, true);
  assert.equal(byName.getInputForm.annotations.readOnlyHint, true);
  assert.ok(TOOL_NAMES_BY_VIEW.INPUT.includes('getOutputOptions'));
  assert.ok(TOOL_NAMES_BY_VIEW.INPUT.includes('getInputForm'));
  assert.ok(!TOOL_NAMES_BY_VIEW.RESULT.includes('getOutputOptions'));
  const appState = { view: 'INPUT' };
  const options = { ok: true, count: 9, checkedCount: 1, options: [{ code: 'graph', checked: true }] };
  const app = {
    getState: () => appState, getLocale: () => 'en',
    getOutputOptions: () => options,
    getInputForm: () => ({ ok: true, caseText: '', charCount: 0, minChars: 20, canSubmit: false, outputs: options, sampleCount: 4 })
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('getOutputOptions', {});
  assert.equal(r.count, 9);
  assert.equal(r.checkedCount, 1);
  const form = await w.execute('getInputForm', {});
  assert.equal(form.minChars, 20);
  assert.equal(form.sampleCount, 4);
  appState.view = 'RUNNING'; appState.last = { status: 'RUNNING' };
  assert.equal((await w.execute('getOutputOptions', {})).error, 'TOOL_UNAVAILABLE');
});
test('getResultTabs 只在 RESULT 提供並轉交 app', async () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.equal(byName.getResultTabs.annotations.readOnlyHint, true);
  assert.ok(TOOL_NAMES_BY_VIEW.RESULT.includes('getResultTabs'));
  assert.ok(!TOOL_NAMES_BY_VIEW.INPUT.includes('getResultTabs'));
  const appState = { view: 'RESULT', last: { status: 'COMPLETED' } };
  const app = { getState: () => appState, getLocale: () => 'en', getResultTabs: () => ({ ok: true, count: 4, activeTab: 'graph', tabs: [] }) };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  assert.equal((await w.execute('getResultTabs', {})).count, 4);
  appState.view = 'INPUT'; appState.last = null;
  assert.equal((await w.execute('getResultTabs', {})).error, 'TOOL_UNAVAILABLE');
});
test('ready 尚未解決前 host callback 不執行工具，解決後才回結果', async () => {
  const active = new Map();
  let resolveReady; const ready = new Promise((r) => { resolveReady = r; });
  const w = createWebMcp({
    app: { getState: () => ({ view: 'INPUT' }), getLocale: () => 'en', getSamples: () => [{ id: 'a', title: 'A', summary: 's' }] },
    graphView: {}, modelContext: { registerTool: async (tool) => active.set(tool.name, tool) }, ready
  });
  await w.syncForState('INPUT');
  let done = false;
  const pending = active.get('listSampleCases').execute({}).then((r) => { done = true; return r; });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false, 'app 未綁定前不得執行');
  resolveReady();
  assert.deepEqual(await pending, [{ id: 'a', title: 'A', summary: 's' }]);
});

test('新工具契約：HOME 可選能力，合約工具只在對應狀態', () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.ok(TOOL_NAMES_BY_VIEW.HOME.includes('selectCapability'));
  assert.ok(TOOL_NAMES_BY_VIEW.RESULT.includes('getComplianceReport'));
  assert.equal(byName.getComplianceReport.annotations.untrustedContentHint, true);
  assert.deepEqual(byName.selectCapability.inputSchema.properties.mode.enum, ['case', 'contract']);
  assert.ok(byName.startContractReview.inputSchema.properties.party.enum.includes('partyB'));
});
test('startContractReview 從 HOME 先選能力再啟動；getComplianceReport 依 risk 過濾', async () => {
  const state = { view: 'HOME', mode: null, last: null };
  const app = {
    getState: () => state, getLocale: () => 'zh-TW', getMode: () => state.mode,
    selectMode: async (m) => { state.view = 'INPUT'; state.mode = m; },
    start: async (text, outputs, files, motion, extra) => { state.view = 'RUNNING'; return { caseId: 'c1', status: 'RUNNING', step: 'LOAD', extra }; },
    startSample: async () => null,
    setRiskFilter: () => {}
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('startContractReview', { contractText: '合約全文超過二十個字的測試內容合約全文', party: 'partyB', scopes: ['labor'] });
  assert.equal(r.ok, true); assert.equal(state.mode, 'contract');
  state.view = 'RESULT'; state.last = { result: { compliance: { overallRisk: 'high', findings: [{ risk: 'high' }, { risk: 'low' }] } } };
  const report = await w.execute('getComplianceReport', { risk: 'high' });
  assert.equal(report.findings.length, 1);
});
test('合約 INPUT 頁呼叫 startCase 回 WRONG_CAPABILITY', async () => {
  const state = { view: 'INPUT', mode: 'contract', last: null };
  const app = { getState: () => state, getLocale: () => 'zh-TW', getMode: () => state.mode, selectMode: async () => {}, start: async () => ({ caseId: 'x' }) };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('startCase', { caseText: '案情文字超過二十個字的測試內容案情文字' });
  assert.equal(r.ok, false); assert.equal(r.error, 'WRONG_CAPABILITY');
  assert.match(r.message, /startContractReview/);
});

test('案件 INPUT 頁呼叫 startContractReview 回 WRONG_CAPABILITY', async () => {
  const state = { view: 'INPUT', mode: 'case', last: null };
  const app = {
    getState: () => state, getLocale: () => 'zh-TW', getMode: () => state.mode,
    selectMode: async () => { throw new Error('不應靜默切換能力'); },
    start: async () => ({ caseId: 'x' })
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const r = await w.execute('startContractReview', { contractText: '合約全文超過二十個字的測試內容合約全文' });
  assert.equal(r.ok, false); assert.equal(r.error, 'WRONG_CAPABILITY');
  assert.match(r.message, /selectCapability/);
});
test('filterFindingsByRisk 只在合約結果頁可用', async () => {
  const state = { view: 'RESULT', mode: 'case', last: null };
  let applied = null;
  const app = {
    getState: () => state, getLocale: () => 'zh-TW', getMode: () => state.mode,
    setRiskFilter: (r) => { applied = r; }
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  // 案件模式結果頁：不可用
  let r = await w.execute('filterFindingsByRisk', { risk: 'high' });
  assert.equal(r.ok, false); assert.equal(r.error, 'TOOL_UNAVAILABLE');
  assert.equal(applied, null);
  // 合約模式但不在結果頁：不可用
  state.mode = 'contract'; state.view = 'RUNNING';
  r = await w.execute('filterFindingsByRisk', { risk: 'high' });
  assert.equal(r.error, 'TOOL_UNAVAILABLE');
  // 合約模式結果頁：可用
  state.view = 'RESULT';
  r = await w.execute('filterFindingsByRisk', { risk: 'high' });
  assert.equal(r.ok, true); assert.equal(applied, 'high');
});

test('getUsageStats 轉交 app.getStats，days 夾在 1～90 且預設 30', async () => {
  const asked = [];
  const payload = { days: [{ day: '2026-09-05', total: 3, totalTokens: 1200 }] };
  const app = {
    getState: () => ({ view: 'HOME' }), getLocale: () => 'en',
    getStats: async (days) => { asked.push(days); return payload; }
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: undefined });
  assert.deepEqual(await w.execute('getUsageStats', {}), payload);
  assert.deepEqual(await w.execute('getUsageStats', { days: 7 }), payload);
  await w.execute('getUsageStats', { days: 900 });
  await w.execute('getUsageStats', { days: 0 });
  assert.deepEqual(asked, [30, 7, 90, 30]);
});

test('app 未提供 getStats 時 getUsageStats 明確回不可用', async () => {
  const w = createWebMcp({ app: { getState: () => ({ view: 'HOME' }), getLocale: () => 'en' }, graphView: {}, modelContext: undefined });
  assert.deepEqual(await w.execute('getUsageStats', {}), { ok: false, error: 'NOT_AVAILABLE' });
});

test('getUsageStats 在後端失敗時回 STATS_UNAVAILABLE 而非丟例外', async () => {
  const app = {
    getState: () => ({ view: 'HOME' }), getLocale: () => 'en',
    getStats: async () => { throw new Error('504'); }
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: undefined });
  assert.deepEqual(await w.execute('getUsageStats', {}), { ok: false, error: 'STATS_UNAVAILABLE', message: '504' });
});

// 用途：結果頁六個讀取工具的失敗回傳統一為 { ok:false, error:'<CODE>', message }；成功回傳不加 ok 欄位
test('結果頁讀取工具失敗一律回統一錯誤 envelope', async () => {
  const appState = { view: 'RESULT', last: { status: 'COMPLETED', result: {} } };
  const app = { getState: () => appState, getLocale: () => 'en' };
  const graphView = { summary: () => null, focus: () => null, filter: () => null, explainEdge: () => null };
  const w = createWebMcp({ app, graphView, modelContext: null });
  const expect = async (name, args, code) => {
    const r = await w.execute(name, args);
    assert.equal(r.ok, false, name);
    assert.equal(r.error, code, name);
    assert.equal(typeof r.message, 'string', name + ' 需帶人類可讀訊息');
  };
  await expect('getAnalysis', { section: 'analysis' }, 'NOT_COMPLETED');
  await expect('getGraphSummary', {}, 'GRAPH_NOT_RENDERED');
  await expect('focusNode', { nodeId: 'x' }, 'NODE_NOT_FOUND');
  await expect('filterGraph', { groups: ['law'] }, 'GRAPH_NOT_RENDERED');
  await expect('explainEdge', { sourceId: 'a', targetId: 'b' }, 'EDGE_NOT_FOUND');
  await expect('getComplianceReport', {}, 'NOT_COMPLETED');
});

test('結果頁讀取工具成功回傳不夾帶 ok 欄位', async () => {
  const appState = { view: 'RESULT', last: { status: 'COMPLETED', result: { analysis: { elements: [] }, compliance: { findings: [] } } } };
  const app = { getState: () => appState, getLocale: () => 'en' };
  const graphView = { summary: () => ({ nodeCounts: {} }), focus: () => ({ neighbors: [] }), filter: () => ({ visibleNodes: 1 }), explainEdge: () => ({ label: '包含' }) };
  const w = createWebMcp({ app, graphView, modelContext: null });
  for (const [name, args] of [['getAnalysis', { section: 'analysis' }], ['getGraphSummary', {}], ['focusNode', { nodeId: 'x' }],
    ['filterGraph', { groups: ['law'] }], ['explainEdge', { sourceId: 'a', targetId: 'b' }], ['getComplianceReport', {}]]) {
    const r = await w.execute(name, args);
    assert.equal(r.ok, undefined, name + ' 成功時不應新增 ok 欄位');
  }
});
