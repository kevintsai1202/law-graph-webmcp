import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFS, truncate, createWebMcp } from '../src/main/resources/static/js/webmcp.js';

// 用途：WebMCP 十工具的契約（名稱／描述長度、annotations、無代答工具）、1500 字元護欄與動態註冊。
test('十個工具，名稱/描述長度符合 Chrome 安全預算', () => {
  assert.equal(TOOL_DEFS.length, 10);
  for (const d of TOOL_DEFS) {
    assert.ok(d.name.length <= 30, d.name);
    assert.ok(d.description.length <= 150, d.name);
    assert.equal(d.inputSchema.type, 'object');
    assert.equal(d.inputSchema.additionalProperties, false, d.name);
    assert.ok(['base', 'completed'].includes(d.phase));
  }
  assert.ok(!TOOL_DEFS.some((d) => /answer/i.test(d.name)), '不得有代答工具');
});
test('唯讀工具帶 readOnlyHint；getAnalysis 帶 untrustedContentHint', () => {
  const byName = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d]));
  assert.equal(byName.getCaseStatus.annotations.readOnlyHint, true);
  assert.equal(byName.getAnalysis.annotations.untrustedContentHint, true);
  assert.equal(byName.startCase.annotations?.readOnlyHint, undefined);
});
test('truncate 超過 1500 字元回摘要', () => {
  const r = truncate({ text: 'x'.repeat(2000) });
  assert.equal(r.truncated, true); assert.ok(JSON.stringify(r).length <= 1500);
  assert.deepEqual(truncate({ a: 1 }), { a: 1 });
});
test('registerBase 只註冊 base 階段工具，registerCompleted 再加圖工具，unregisterAll 全部 abort', async () => {
  const registered = []; let aborted = 0;
  const fakeContext = { registerTool: async (tool, opts) => { registered.push(tool.name); opts.signal.addEventListener('abort', () => aborted++); } };
  const w = createWebMcp({ app: {}, graphView: {}, modelContext: fakeContext });
  await w.registerBase();
  assert.deepEqual([...registered].sort(), ['getCaseStatus', 'listSampleCases', 'resetCase', 'startCase', 'verifyCitation']);
  await w.registerCompleted();
  assert.equal(registered.length, 10);
  w.unregisterAll(); assert.equal(aborted, 10); assert.equal(w.tools().length, 0);
});
test('無 WebMCP 環境時仍記錄各階段可用工具，供 Inspector 顯示', async () => {
  const w = createWebMcp({ app: {}, graphView: {}, modelContext: undefined });
  await w.registerBase(); assert.equal(w.tools().length, 5);
  await w.registerCompleted(); assert.equal(w.tools().length, 10);
  w.unregisterAll(); assert.equal(w.tools().length, 0);
});
test('startCase 於案件進行中拒絕；getCaseStatus 不夾帶 result 全文', async () => {
  const app = {
    getState: () => ({ view: 'RESULT', last: { caseId: 'p1', status: 'COMPLETED', result: { graph: {} } } }),
    getLocale: () => 'en'
  };
  const w = createWebMcp({ app, graphView: {}, modelContext: null });
  const refused = await w.execute('startCase', { caseText: 'x'.repeat(30) });
  assert.equal(refused.ok, false);
  const status = await w.execute('getCaseStatus', {});
  assert.equal(status.hasResult, true); assert.equal(status.result, undefined);
});
