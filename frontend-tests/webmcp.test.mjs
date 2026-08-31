import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFS, TOOL_NAMES_BY_VIEW, truncate, createWebMcp, resolveModelContext } from '../src/main/resources/static/js/webmcp.js';

// 用途：WebMCP 十二工具契約、狀態矩陣（名稱／描述長度、annotations、無自動送出工具）與 1500 字元護欄。
test('十二個工具，名稱/描述長度符合 Chrome 安全預算', () => {
  assert.equal(TOOL_DEFS.length, 12);
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
  assert.equal(aborted, 3 + 2 + 4 + 8, '每次真正切換都應解除上一批工具');
  w.unregisterAll();
  assert.equal(aborted, 3 + 2 + 4 + 8 + 2, '清理時應解除最後一批工具');
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
