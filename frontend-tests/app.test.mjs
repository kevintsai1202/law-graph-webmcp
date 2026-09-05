import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/main/resources/static/js/app.js';

/** 儲存原始 DOMParser，測試後還原全域環境。 */
const originalDomParser = globalThis.DOMParser;

before(() => {
  /** 最小 DOMParser 替身：本測試只驗證應用層參數轉交，不解析實際畫面。 */
  globalThis.DOMParser = class {
    parseFromString() { return { body: { childNodes: [] } }; }
  };
});

after(() => {
  if (originalDomParser === undefined) delete globalThis.DOMParser;
  else globalThis.DOMParser = originalDomParser;
});

/** 建立足以讓 RUNNING 畫面重繪的最小根節點。 */
function fakeRoot() {
  const stage = {
    replaceChildren() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  return {
    querySelector(selector) { return selector === '#stage' ? stage : null; },
    querySelectorAll() { return []; }
  };
}

/** 建立記憶體 storage，驗證案件與輸出選擇會一起保存。 */
function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

/** mount 需要語系選單節點；在 fakeRoot 上補一個可設值、可綁事件的 #lang-select 替身。 */
function mountRoot() {
  /** 任意選擇器都回一個萬用節點替身，讓 INPUT／FAILED 畫面的事件綁定不因缺節點而中斷。 */
  const stub = () => ({
    value: '', files: [], disabled: false, textContent: '', dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, replaceChildren() {}, click() {}, setAttribute() {}, append() {}
  });
  const stage = { replaceChildren() {}, querySelector: () => stub(), querySelectorAll() { return []; } };
  const langSelect = stub();
  return {
    querySelector(selector) { return selector === '#stage' ? stage : selector === '#lang-select' ? langSelect : null; },
    querySelectorAll() { return []; }
  };
}

test('mount 續接的案件已不存在（例如服務重啟）時清除記錄並回到首頁，而不是顯示分析失敗', async () => {
  const client = {
    async samples() { return []; },
    async authStatus() { return { enabled: false }; },
    poll(id, onStatus) {
      onStatus({ status: 'FAILED', error: { code: 'CASE_NOT_FOUND', message: `case not found: ${id}` } });
      return () => {};
    },
    verify() {}
  };
  const storage = fakeStorage();
  storage.setItem('caseId', 'pensive_heisenberg');
  storage.setItem('outputs', '["graph"]');
  const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW' });

  await app.mount();

  // 案件記錄清空後回到能力入口首頁（HOME），使用者可重新選擇案件分析或合約審查
  assert.equal(app.getState().view, 'HOME');
  assert.equal(storage.getItem('caseId'), null);
  assert.equal(storage.getItem('outputs'), null);
});

test('進行中案件回 CASE_NOT_FOUND 以外的失敗仍顯示失敗頁', async () => {
  const client = {
    async samples() { return []; },
    async authStatus() { return { enabled: false }; },
    poll(id, onStatus) {
      onStatus({ status: 'FAILED', step: 'RESEARCH', error: { code: 'LLM_ERROR', message: 'boom' } });
      return () => {};
    },
    verify() {}
  };
  const storage = fakeStorage();
  storage.setItem('caseId', 'case-9');
  const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW' });

  await app.mount();

  assert.equal(app.getState().view, 'FAILED');
  assert.equal(storage.getItem('caseId'), 'case-9');
});

test('createApp 啟動案件時完整轉交輸出選擇與附件', async () => {
  const calls = [];
  const client = {
    async start(...args) {
      calls.push(args);
      return { caseId: 'case-1', status: 'RUNNING', step: 'BRAINSTORM' };
    },
    poll() { return () => {}; },
    verify() {}
  };
  const storage = fakeStorage();
  const app = createApp({ root: fakeRoot(), client, storage, navigatorLanguage: 'zh-TW' });
  const file = { name: 'facts.md', size: 10 };

  await app.start('', ['complaint'], [file]);

  assert.deepEqual(calls[0], ['', 'zh-TW', ['complaint'], [file], '']);
  // 另建一個 app 實例驗證聲請事項參數（fakeRoot 沒有輸入頁節點，不走 reset 重繪）
  const app2 = createApp({ root: fakeRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW' });
  await app2.start('甲乙就契約效力有爭執，請求判決確認契約無效並返還價金。', ['motion'], [], '聲請假扣押');
  assert.deepEqual(calls[1], ['甲乙就契約效力有爭執，請求判決確認契約無效並返還價金。', 'zh-TW', ['motion'], [], '聲請假扣押']);
  assert.equal(storage.getItem('caseId'), 'case-1');
  assert.equal(storage.getItem('outputs'), '["complaint"]');
  assert.equal(typeof app.setOutputs, 'function');
  assert.equal(typeof app.getInputForm, 'function');
  assert.equal(typeof app.getResultTabs, 'function');
});

test('回答提交失敗（例如服務重啟後案件不存在）要顯示失敗頁，不能沒有反應', async () => {
  const client = {
    async samples() { return []; },
    async authStatus() { return { enabled: false }; },
    async answer() { const e = new Error('case not found: lost_case'); e.status = 404; e.code = 'CASE_NOT_FOUND'; throw e; },
    poll() { return () => {}; },
    verify() {}
  };
  const app = createApp({ root: mountRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW' });
  await app.mount();
  app.dispatch({ type: 'START', caseId: 'lost_case' });
  app.dispatch({ type: 'STATUS', status: { caseId: 'lost_case', status: 'WAITING', step: 'QUESTIONS', questions: [{ id: 'q1', text: '?', why: 'w' }] } });
  assert.equal(app.getState().view, 'QUESTIONS');
  await assert.rejects(() => app.answer([{ questionId: 'q1', answer: 'x' }]));
  assert.equal(app.getState().view, 'FAILED');
  assert.equal(app.getState().last.error.code, 'CASE_NOT_FOUND');
  assert.match(app.getState().last.error.message, /lost_case/);
});

test('selectMode 進入輸入頁並寫 hash；start 帶 mode 給 client 且存 storage', async () => {
  const calls = [];
  const client = {
    samples: async (locale, mode) => { calls.push(['samples', mode]); return []; },
    start: async (text, locale, documents, files, motion, extra) => { calls.push(['start', documents, extra]); return { caseId: 'c1', status: 'RUNNING', step: 'LOAD', mode: 'contract' }; },
    poll: () => () => {}, usage: async () => null, quota: async () => null, authStatus: async () => null
  };
  const storage = fakeStorage();
  const loc = { hash: '', pathname: '/', search: '', assign() {} };
  const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW', locationLike: loc });
  await app.mount();
  assert.equal(app.getState().view, 'HOME');
  await app.selectMode('contract');
  assert.equal(app.getState().view, 'INPUT'); assert.equal(app.getMode(), 'contract'); assert.equal(loc.hash, '#/contract');
  assert.ok(calls.some(([k, m]) => k === 'samples' && m === 'contract'));
  await app.start('合約全文超過二十個字的測試內容合約全文', ['revised'], [], '', { party: 'partyB', scopes: ['labor'] });
  const startCall = calls.find(([k]) => k === 'start');
  assert.deepEqual(startCall[1], ['revised']);
  assert.equal(startCall[2].mode, 'contract'); assert.equal(startCall[2].party, 'partyB');
  assert.equal(storage.getItem('mode'), 'contract'); assert.equal(storage.getItem('caseId'), 'c1');
});

test('mount 依 hash 進入對應模式輸入頁；續接時讀 storage.mode', async () => {
  const client = { samples: async () => [], poll: (id, cb) => { cb({ caseId: id, status: 'RUNNING', step: 'REVIEW', mode: 'contract' }); return () => {}; }, usage: async () => null, quota: async () => null, authStatus: async () => null };
  const storage = fakeStorage();
  const byHash = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'en', locationLike: { hash: '#/case', pathname: '/', search: '' } });
  await byHash.mount();
  assert.equal(byHash.getState().view, 'INPUT'); assert.equal(byHash.getMode(), 'case');
  storage.setItem('caseId', 'c9'); storage.setItem('mode', 'contract'); storage.setItem('outputs', '[]');
  const resumed = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'en', locationLike: { hash: '', pathname: '/', search: '' } });
  await resumed.mount();
  assert.equal(resumed.getMode(), 'contract'); assert.equal(resumed.getState().view, 'RUNNING');
});

/** 建立帶有輸出勾選框的根節點替身，供 setOutputs 測試代勾可見表單。 */
function outputsRoot(values) {
  const base = mountRoot();
  const boxes = values.map((value) => ({ value, checked: false, dispatchEvent() {} }));
  return {
    querySelector: (selector) => base.querySelector(selector),
    querySelectorAll: (selector) => (selector === 'input[name="outputs"]' ? boxes : []),
    boxes
  };
}

test('setOutputs 依模式驗證：合約模式接受 revised、拒絕 graph', async () => {
  const client = { samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null, authStatus: async () => null };
  const root = outputsRoot(['revised']);
  const app = createApp({ root, client, storage: fakeStorage(), navigatorLanguage: 'zh-TW', locationLike: { hash: '', pathname: '/', search: '' } });
  await app.mount();
  await app.selectMode('contract');

  const ok = app.setOutputs(['revised']);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.applied, ['revised']);
  assert.equal(root.boxes[0].checked, true);

  const bad = app.setOutputs(['graph']);
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'INVALID_OUTPUTS');
  assert.deepEqual(bad.validOutputs, ['revised']);
});

test('完成頁把 hash 改回 #/ 會回首頁並清除案件記錄', async () => {
  const originalAdd = globalThis.addEventListener;
  /** 攔截 app 註冊的 hashchange 監聽器，測試中直接觸發。 */
  let onHashChange = null;
  globalThis.addEventListener = (type, handler) => { if (type === 'hashchange') onHashChange = handler; };
  try {
    const client = { samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null, authStatus: async () => null };
    const storage = fakeStorage();
    const loc = { hash: '', pathname: '/', search: '' };
    const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW', locationLike: loc });
    await app.mount();
    await app.selectMode('contract');
    storage.setItem('caseId', 'c5'); storage.setItem('mode', 'contract');
    app.dispatch({ type: 'START', caseId: 'c5', mode: 'contract' });
    app.dispatch({ type: 'STATUS', status: { caseId: 'c5', status: 'COMPLETED', mode: 'contract', result: {} } });
    assert.equal(app.getState().view, 'RESULT');

    loc.hash = '#/';
    assert.equal(typeof onHashChange, 'function');
    await onHashChange();
    assert.equal(app.getState().view, 'HOME');
    assert.equal(storage.getItem('caseId'), null);
  } finally {
    globalThis.addEventListener = originalAdd;
  }
});

test('合約模式 RESULT 預設分頁為 findings（即使結果帶圖）', async () => {
  const client = { samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null, authStatus: async () => null };
  const storage = fakeStorage();
  const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW', locationLike: { hash: '', pathname: '/', search: '' } });
  await app.mount();
  await app.selectMode('contract');
  // 不經 start()，直接派送完成狀態：模組預設的 graph 仍須改回 findings
  app.dispatch({ type: 'START', caseId: 'c7', mode: 'contract' });
  app.dispatch({ type: 'STATUS', status: { caseId: 'c7', status: 'COMPLETED', step: 'GRAPH', mode: 'contract',
    result: { graph: { nodes: [], edges: [] }, compliance: { overallRisk: 'high', findings: [] } } } });
  assert.equal(app.getState().view, 'RESULT');
  assert.equal(app.getResultTabs().activeTab, 'findings');
});

test('mount 時 hash 為 #/stats 會載入統計資料並停在統計頁；getStats 轉交 client', async () => {
  let askedDays = null;
  const payload = { days: [{ day: '2026-09-05', total: 1 }] };
  const client = {
    samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null,
    authStatus: async () => null,
    stats: async (days) => { askedDays = days; return payload; }
  };
  const app = createApp({ root: mountRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW', locationLike: { hash: '#/stats', pathname: '/', search: '' } });
  await app.mount();
  assert.equal(app.getState().view, 'STATS');
  assert.equal(askedDays, 30);
  assert.deepEqual(await app.getStats(7), payload);
  assert.equal(askedDays, 7);
});

test('進入統計頁只呼叫一次 client.stats：dispatch 同步網址 hash 觸發的 hashchange 不應重複抓取', async () => {
  const originalAdd = globalThis.addEventListener;
  let onHashChange = null;
  globalThis.addEventListener = (type, handler) => { if (type === 'hashchange') onHashChange = handler; };
  let statsCalls = 0;
  const client = {
    samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null,
    authStatus: async () => null,
    stats: async () => { statsCalls += 1; return { days: [] }; }
  };
  // 模擬真實瀏覽器行為：JS 設定 location.hash 會同步觸發 hashchange 監聽器（測試用其他 locationLike 都是純資料物件，不會觸發）
  let hashValue = '';
  const loc = {
    pathname: '/', search: '',
    get hash() { return hashValue; },
    set hash(v) { if (v === hashValue) return; hashValue = v; onHashChange && onHashChange(); }
  };
  try {
    const app = createApp({ root: mountRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW', locationLike: loc });
    await app.mount();
    await app.showStats();
    assert.equal(statsCalls, 1);
    assert.equal(app.getState().view, 'STATS');
  } finally {
    globalThis.addEventListener = originalAdd;
  }
});

test('showStats 例外不得卡住 statsInFlight：拋錯後仍能再次進入統計頁', async () => {
  let statsCalls = 0;
  const client = {
    samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null,
    authStatus: async () => null,
    stats: async () => {
      statsCalls += 1;
      // 第一次丟出一個連 message 都會爆的物件，讓 catch 區塊自己也拋錯、逸出 showStats
      if (statsCalls === 1) throw { get message() { throw new Error('boom'); } };
      return { days: [] };
    }
  };
  const app = createApp({ root: mountRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW', locationLike: { hash: '', pathname: '/', search: '' } });
  await app.mount();

  await assert.rejects(() => app.showStats());
  // 旗標若沒被 finally 放掉，第二次呼叫會直接 return，statsCalls 停在 1
  await app.showStats();
  assert.equal(statsCalls, 2);
  assert.equal(app.getState().view, 'STATS');
});

test('統計頁為唯讀分頁：進行中的案件在返回 #/case 時直接回到進行中畫面，不被捨棄', async () => {
  const originalAdd = globalThis.addEventListener;
  let onHashChange = null;
  globalThis.addEventListener = (type, handler) => { if (type === 'hashchange') onHashChange = handler; };
  try {
    const client = {
      samples: async () => [], poll: () => () => {}, usage: async () => null, quota: async () => null,
      authStatus: async () => null, stats: async () => ({ days: [] })
    };
    const storage = fakeStorage();
    const loc = { hash: '', pathname: '/', search: '' };
    const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW', locationLike: loc });
    await app.mount();
    await app.selectMode('case');
    storage.setItem('caseId', 'c9'); storage.setItem('mode', 'case');
    app.dispatch({ type: 'START', caseId: 'c9', mode: 'case' });
    app.dispatch({ type: 'STATUS', status: { caseId: 'c9', status: 'RUNNING', step: 'BRAINSTORM', mode: 'case' } });
    assert.equal(app.getState().view, 'RUNNING');

    loc.hash = '#/stats';
    await onHashChange();
    assert.equal(app.getState().view, 'STATS');
    assert.equal(app.getState().caseId, 'c9');

    loc.hash = '#/case';
    await onHashChange();
    assert.equal(app.getState().view, 'RUNNING');
    assert.equal(storage.getItem('caseId'), 'c9');
  } finally {
    globalThis.addEventListener = originalAdd;
  }
});

/** 建立可手動觸發 hashchange 的環境；回傳 { app, loc, hashTo, restore }。 */
function withHashChange(client, storage = fakeStorage(), hash = '') {
  const originalAdd = globalThis.addEventListener;
  let onHashChange = null;
  globalThis.addEventListener = (type, handler) => { if (type === 'hashchange') onHashChange = handler; };
  const loc = { hash, pathname: '/', search: '' };
  const app = createApp({ root: mountRoot(), client, storage, navigatorLanguage: 'zh-TW', locationLike: loc });
  return { app, loc, storage, hashTo: async (next) => { loc.hash = next; return onHashChange(); }, restore: () => { globalThis.addEventListener = originalAdd; } };
}

test('統計頁不被輪詢踢回：案件輪詢期間停在 STATS，但 last 持續更新', async () => {
  let onStatus = null;
  const client = {
    samples: async () => [], usage: async () => null, quota: async () => null, authStatus: async () => null,
    poll: (id, cb) => { onStatus = cb; return () => {}; },
    stats: async () => ({ days: [] })
  };
  const storage = fakeStorage();
  storage.setItem('caseId', 'c1'); storage.setItem('mode', 'case');
  const h = withHashChange(client, storage);
  try {
    // 由 mount 續接案件才會真的啟動輪詢，測試才拿得到 poll 的回呼
    await h.app.mount();
    onStatus?.({ caseId: 'c1', status: 'RUNNING', step: 'BRAINSTORM', mode: 'case' });
    assert.equal(h.app.getState().view, 'RUNNING');
    await h.hashTo('#/stats');
    assert.equal(h.app.getState().view, 'STATS');
    // 模擬輪詢兩次回報：畫面必須留在統計頁
    onStatus?.({ caseId: 'c1', status: 'RUNNING', step: 'RESEARCH', mode: 'case' });
    onStatus?.({ caseId: 'c1', status: 'RUNNING', step: 'ANALYSIS', mode: 'case' });
    assert.equal(h.app.getState().view, 'STATS');
    assert.equal(h.app.getState().last.step, 'ANALYSIS');
  } finally { h.restore(); }
});

test('離開統計頁：沒有案件時回到該模式輸入頁，不會卡在統計頁', async () => {
  const client = {
    samples: async () => [], usage: async () => null, quota: async () => null, authStatus: async () => null,
    poll: () => () => {}, stats: async () => ({ days: [] })
  };
  const h = withHashChange(client);
  try {
    await h.app.mount();
    await h.hashTo('#/stats');
    assert.equal(h.app.getState().view, 'STATS');
    await h.hashTo('#/case');
    assert.equal(h.app.getState().view, 'INPUT');
    assert.equal(h.app.getMode(), 'case');
    // 回首頁同理
    await h.hashTo('#/stats');
    await h.hashTo('#/');
    assert.equal(h.app.getState().view, 'HOME');
  } finally { h.restore(); }
});

test('離開統計頁：已完成的合約案件會被還原成結果頁而非捨棄', async () => {
  const client = {
    samples: async () => [], usage: async () => null, quota: async () => null, authStatus: async () => null,
    poll: () => () => {}, stats: async () => ({ days: [] })
  };
  const h = withHashChange(client);
  try {
    await h.app.mount();
    await h.app.selectMode('contract');
    h.storage.setItem('caseId', 'c7'); h.storage.setItem('mode', 'contract');
    h.app.dispatch({ type: 'START', caseId: 'c7', mode: 'contract' });
    h.app.dispatch({ type: 'STATUS', status: { caseId: 'c7', status: 'COMPLETED', mode: 'contract', result: {} } });
    assert.equal(h.app.getState().view, 'RESULT');
    await h.hashTo('#/stats');
    assert.equal(h.app.getState().view, 'STATS');
    await h.hashTo('#/contract');
    assert.equal(h.app.getState().view, 'RESULT');
    assert.equal(h.storage.getItem('caseId'), 'c7');
  } finally { h.restore(); }
});

test('回答送出後若後端仍回同一組問題的過期 WAITING，畫面改為進行中並持續輪詢，不能停在原表單', async () => {
  const stale = { caseId: 'c1', status: 'WAITING', step: 'QUESTIONS', questions: [{ id: 'q1', text: '?', why: 'w' }] };
  let pollOpts = null;
  const client = {
    async samples() { return []; },
    async authStatus() { return { enabled: false }; },
    async answer() { return stale; },
    poll(id, onStatus, intervalMs, opts) { pollOpts = opts; return () => {}; },
    verify() {}
  };
  const app = createApp({ root: mountRoot(), client, storage: fakeStorage(), navigatorLanguage: 'zh-TW' });
  await app.mount();
  app.dispatch({ type: 'START', caseId: 'c1' });
  app.dispatch({ type: 'STATUS', status: stale });
  assert.equal(app.getState().view, 'QUESTIONS');
  const s = await app.answer([{ questionId: 'q1', answer: 'x' }]);
  assert.equal(s.status, 'RUNNING');
  assert.equal(app.getState().view, 'RUNNING');
  assert.equal(app.getState().last.questions, null);
  // 輪詢要能略過同一組問題的過期 WAITING；換了一組新問題則正常停下
  assert.equal(pollOpts.skipWaitingIf(stale), true);
  assert.equal(pollOpts.skipWaitingIf({ status: 'WAITING', questions: [{ id: 'r2q1' }] }), false);
});
