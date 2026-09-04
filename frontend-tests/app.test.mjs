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

test('mount 續接的案件已不存在（例如服務重啟）時清除記錄並回到輸入頁，而不是顯示分析失敗', async () => {
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

  assert.equal(app.getState().view, 'INPUT');
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

  assert.deepEqual(calls[0], ['', 'zh-TW', ['complaint'], [file]]);
  assert.equal(storage.getItem('caseId'), 'case-1');
  assert.equal(storage.getItem('outputs'), '["complaint"]');
  assert.equal(typeof app.setOutputs, 'function');
  assert.equal(typeof app.getInputForm, 'function');
  assert.equal(typeof app.getResultTabs, 'function');
});
