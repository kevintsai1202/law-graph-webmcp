import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaseClient } from '../src/main/resources/static/js/caseClient.js';

// 用途：以假 fetch 驗證 REST 封裝的路徑、payload、錯誤物件與輪詢停止條件。
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const hit = routes.shift();
    return { ok: hit.ok ?? true, status: hit.status ?? 200, json: async () => hit.body };
  };
  f.calls = calls; return f;
}

test('start 送 POST /api/cases 並回 JSON', async () => {
  const fetch = fakeFetch([{ status: 201, body: { caseId: 'p1', status: 'RUNNING' } }]);
  const c = createCaseClient(fetch);
  const r = await c.start('A hit B', 'zh-TW');
  assert.equal(r.caseId, 'p1');
  assert.equal(fetch.calls[0].url, '/api/cases');
  assert.deepEqual(JSON.parse(fetch.calls[0].body), { caseText: 'A hit B', locale: 'zh-TW' });
});
test('start 可附上勾選書狀 documents', async () => {
  const fetch = fakeFetch([{ status: 201, body: { caseId: 'p1', status: 'RUNNING' } }]);
  const c = createCaseClient(fetch);
  await c.start('A hit B', 'zh-TW', ['complaint', 'issues']);
  assert.deepEqual(JSON.parse(fetch.calls[0].body),
    { caseText: 'A hit B', locale: 'zh-TW', documents: ['complaint', 'issues'] });
});
test('start 有檔案時改送 multipart 且不手動設定 Content-Type', async () => {
  const fetch = fakeFetch([{ status: 201, body: { caseId: 'p2', status: 'RUNNING' } }]);
  const c = createCaseClient(fetch);
  const file = new Blob(['# facts'], { type: 'text/markdown' });
  Object.defineProperty(file, 'name', { value: 'facts.md' });
  await c.start('', 'zh-TW', ['complaint'], [file]);
  const call = fetch.calls[0];
  assert.ok(call.body instanceof FormData);
  assert.equal(call.body.get('locale'), 'zh-TW');
  assert.equal(call.body.get('documents'), 'complaint');
  assert.equal(call.body.get('files').name, 'facts.md');
});
test('非 2xx 丟出含 status 的錯誤', async () => {
  const c = createCaseClient(fakeFetch([{ ok: false, status: 429, body: { error: 'RATE_LIMITED' } }]));
  await assert.rejects(c.start('x', 'en'), (e) => e.status === 429 && e.code === 'RATE_LIMITED');
});
test('authStatus 查詢語意檢索 OAuth 狀態', async () => {
  const fetch = fakeFetch([{ body: { enabled: true, authorized: false } }]);
  const status = await createCaseClient(fetch).authStatus();
  assert.deepEqual(status, { enabled: true, authorized: false });
  assert.equal(fetch.calls[0].url, '/api/auth/tw-legal-rag/status');
  assert.equal(fetch.calls[0].method, 'GET');
});
test('poll 於 WAITING 停止（等待人工回答時不重繪表單，避免打字被洗掉；answer 後再續接）', async () => {
  const fetch = fakeFetch([{ body: { status: 'RUNNING' } }, { body: { status: 'WAITING', questions: [] } }, { body: { status: 'WAITING' } }]);
  const c = createCaseClient(fetch);
  const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s.status); if (s.status === 'WAITING') res(); }, 5); });
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(seen, ['RUNNING', 'WAITING']);
  assert.equal(fetch.calls.length, 2, 'WAITING 後不得再輪詢');
});
test('poll 於 COMPLETED 自動停止', async () => {
  const fetch = fakeFetch([{ body: { status: 'RUNNING' } }, { body: { status: 'COMPLETED' } }, { body: { status: 'COMPLETED' } }]);
  const c = createCaseClient(fetch);
  const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s.status); if (s.status === 'COMPLETED') res(); }, 5); });
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(seen, ['RUNNING', 'COMPLETED']);
  assert.equal(fetch.calls.length, 2, 'COMPLETED 後不得再輪詢');
});
