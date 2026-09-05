import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaseClient } from '../src/main/resources/static/js/caseClient.js';

test('入口請求逾時可中止，案件提交不套用入口逾時', async () => {
  const calls = [];
  const client = createCaseClient(async (path, init) => {
    calls.push({ path, init });
    if (!init.signal) return { ok: true, json: async () => ({ caseId: 'created' }) };
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  }, '', { entryTimeoutMs: 15 });
  // AbortSignal 的計時器不保留 Node 行程，測試期間明確維持事件迴圈。
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(client.me(), { name: 'TimeoutError' });
    assert.equal((await client.start('fictional case', 'en')).caseId, 'created');
    assert.equal(calls[1].init.signal, undefined);
  } finally { clearInterval(keepAlive); }
});

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
test('poll 遇到短暫 502／網路錯誤會重試，恢復後繼續，不會誤判失敗', async () => {
  const fetch = fakeFetch([
    { ok: false, status: 502, body: {} }, { ok: false, status: 502, body: {} },
    { body: { status: 'RUNNING' } }, { body: { status: 'COMPLETED' } }
  ]);
  const c = createCaseClient(fetch); const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s.status); if (s.status === 'COMPLETED') res(); }, 5, { maxFailures: 3, failureIntervalMs: 5 }); });
  assert.deepEqual(seen, ['RUNNING', 'COMPLETED']);
});
test('poll 連續失敗達上限才回 FAILED／NETWORK 並停止', async () => {
  const fetch = fakeFetch([
    { ok: false, status: 502, body: {} }, { ok: false, status: 502, body: {} }, { ok: false, status: 502, body: {} },
    { body: { status: 'RUNNING' } }
  ]);
  const c = createCaseClient(fetch); const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s); if (s.status === 'FAILED') res(); }, 5, { maxFailures: 3, failureIntervalMs: 5 }); });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].error.code, 'NETWORK');
  assert.match(seen[0].error.message, /502/);
  assert.equal(fetch.calls.length, 3);
});
test('poll 遇到 404 CASE_NOT_FOUND 立即失敗，不重試', async () => {
  const fetch = fakeFetch([{ ok: false, status: 404, body: { error: 'CASE_NOT_FOUND', message: 'gone' } }, { body: { status: 'RUNNING' } }]);
  const c = createCaseClient(fetch); const seen = [];
  await new Promise((res) => { c.poll('p1', (s) => { seen.push(s); res(); }, 5, { maxFailures: 3, failureIntervalMs: 5 }); });
  assert.equal(seen[0].error.code, 'CASE_NOT_FOUND');
  assert.equal(fetch.calls.length, 1);
});

test('start 帶 extra.mode／party／scopes 時放進 JSON，samples 帶 mode', async () => {
  const calls = [];
  const client = createCaseClient(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({}) }; });
  await client.start('合約', 'zh-TW', ['revised'], [], '', { mode: 'contract', party: 'partyB', scopes: ['labor'] });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.mode, 'contract'); assert.equal(body.party, 'partyB'); assert.deepEqual(body.scopes, ['labor']); assert.deepEqual(body.documents, ['revised']);
  await client.samples('zh-TW', 'contract');
  assert.match(calls[1].url, /\/api\/samples\?locale=zh-TW&mode=contract/);
  await client.start('A hit B', 'en', [], []);
  assert.equal(JSON.parse(calls[2].init.body).mode, undefined);
});

test('start 於 multipart（有附件）分支帶 extra.mode 時附上 mode／party／scopes，不設 Content-Type；case 模式無 mode 欄位', async () => {
  const calls = [];
  const client = createCaseClient(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({}) }; });
  const fakeFile = new File(['x'], 'c.md');
  await client.start('合約', 'zh-TW', ['revised'], [fakeFile], '', { mode: 'contract', party: 'partyA', scopes: ['labor', 'privacy'] });
  const { init } = calls[0];
  assert.ok(init.body instanceof FormData, 'multipart 分支應送出 FormData');
  assert.equal(init.body.get('mode'), 'contract');
  assert.equal(init.body.get('party'), 'partyA');
  assert.deepEqual(init.body.getAll('scopes'), ['labor', 'privacy']);
  assert.deepEqual(init.body.getAll('documents'), ['revised']);
  assert.equal(init.headers, undefined, 'FormData 由瀏覽器自帶正確 multipart boundary，不應手動設 Content-Type');
  // case 模式（無 extra）也走 multipart 分支時，不應出現 mode 欄位
  await client.start('A hit B', 'en', [], [fakeFile]);
  assert.equal(calls[1].init.body.get('mode'), null);
});
