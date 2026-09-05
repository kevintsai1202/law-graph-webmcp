import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, hashFor, MODES } from '../src/main/resources/static/js/router.js';

// 用途：hash 與 {view, mode} 互轉；未知 hash 回首頁。
test('parseHash', () => {
  assert.deepEqual(parseHash(''), { view: 'HOME', mode: null });
  assert.deepEqual(parseHash('#/'), { view: 'HOME', mode: null });
  assert.deepEqual(parseHash('#/case'), { view: 'INPUT', mode: 'case' });
  assert.deepEqual(parseHash('#/contract'), { view: 'INPUT', mode: 'contract' });
  assert.deepEqual(parseHash('#/nope'), { view: 'HOME', mode: null });
});
test('hashFor', () => {
  assert.equal(hashFor({ view: 'HOME', mode: null }), '#/');
  assert.equal(hashFor({ view: 'INPUT', mode: 'contract' }), '#/contract');
  assert.equal(hashFor({ view: 'RUNNING', mode: 'case' }), '#/case');
  assert.deepEqual(MODES, ['case', 'contract']);
});

test('#/stats 解析為統計頁，且狀態可反推回 #/stats', () => {
  assert.deepEqual(parseHash('#/stats'), { view: 'STATS', mode: null });
  assert.equal(hashFor({ view: 'STATS', mode: null }), '#/stats');
  // 統計頁保留 mode 時仍應停在 #/stats，避免離開統計頁前網址就先跳回流程
  assert.equal(hashFor({ view: 'STATS', mode: 'contract' }), '#/stats');
});
