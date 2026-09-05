import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticAuthPath } from '../src/main/resources/static/js/app.js';

/** authorizationRequired 時需導向本站 OAuth start endpoint。 */
test('semanticAuthPath builds a same-site OAuth start path', () => {
  const path = semanticAuthPath({ result: { research: { coverage: { authorizationRequired: true } } } }, {
    pathname: '/case', search: '?locale=zh-TW'
  });
  assert.equal(path, '/api/auth/tw-legal-rag/start?returnTo=%2Fcase%3Flocale%3Dzh-TW');
});

/** callback 返回帶 mcpAuth 時不得再次自動導向造成 redirect loop。 */
test('semanticAuthPath ignores callback return', () => {
  const path = semanticAuthPath({ result: { research: { coverage: { authorizationRequired: true } } } }, {
    pathname: '/', search: '?mcpAuth=success'
  });
  assert.equal(path, null);
});

/** semantic disabled 或成功時不產生 OAuth navigation。 */
test('semanticAuthPath is empty when authorization is not required', () => {
  assert.equal(semanticAuthPath({ result: { research: { coverage: { authorizationRequired: false } } } }), null);
});

/** 分析中途不得把整頁導向第三方授權站：只顯示橫幅，導向交給使用者點連結。 */
test('authorizationRequired 不再觸發 location.assign，狀態照常更新', async () => {
  const { createApp } = await import('../src/main/resources/static/js/app.js');
  const assigned = [];
  const originalLocation = globalThis.location, originalDomParser = globalThis.DOMParser;
  globalThis.location = { pathname: '/', search: '', hash: '', assign: (u) => assigned.push(u) };
  /** 最小 DOMParser 替身：本測試只驗證不導向，不解析畫面。 */
  globalThis.DOMParser = class { parseFromString() { return { body: { childNodes: [] } }; } };
  try {
    const client = { async samples() { return []; }, async authStatus() { return { enabled: true, authorized: true }; }, poll() { return () => {}; } };
    const stage = { replaceChildren() {}, querySelector: () => null, querySelectorAll: () => [] };
    const root = { querySelector: (s) => (s === '#stage' ? stage : null), querySelectorAll: () => [] };
    const storage = new Map();
    const app = createApp({ root, client, storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) }, navigatorLanguage: 'zh-TW' });
    await app.mount();
    app.dispatch({ type: 'START', caseId: 'c1' });
    app.dispatch({ type: 'STATUS', status: { caseId: 'c1', status: 'RUNNING', step: 'ANALYSIS', result: { research: { laws: [], judgments: [], notes: [], coverage: { authorizationRequired: true } } } } });
    assert.deepEqual(assigned, []);
    assert.equal(app.getState().view, 'RUNNING');
  } finally {
    if (originalLocation === undefined) delete globalThis.location; else globalThis.location = originalLocation;
    if (originalDomParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = originalDomParser;
  }
});

test('semanticAuthBanner 在需要授權時回傳含授權連結的橫幅，否則為空字串', async () => {
  const { semanticAuthBanner } = await import('../src/main/resources/static/js/app.js');
  const status = { result: { research: { coverage: { authorizationRequired: true } } } };
  const html = semanticAuthBanner(status, 'zh-TW', { pathname: '/', search: '' });
  assert.match(html, /semantic-auth-banner/);
  assert.match(html, /href="\/api\/auth\/tw-legal-rag\/start\?returnTo=%2F"/);
  assert.match(html, /語意檢索：未授權/);
  assert.equal(semanticAuthBanner({ result: { research: { coverage: { authorizationRequired: false } } } }, 'zh-TW', { pathname: '/', search: '' }), '');
  // 授權回來（網址帶 mcpAuth）就不再提示
  assert.equal(semanticAuthBanner(status, 'zh-TW', { pathname: '/', search: '?mcpAuth=success' }), '');
});
