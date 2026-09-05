import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateChecker } from '../src/main/resources/static/js/updateCheck.js';
import { renderUpdateBanner, bindUpdateBanner } from '../src/main/resources/static/js/views/updateBanner.js';

// 用途：網站重佈後，前端比對 /api/version 發現版本不同時通知一次；取版本失敗要靜默，不得打斷頁面。

/** 可控的假 fetchVersion：依序回傳 queue 裡的值，或丟出錯誤。 */
const fakeVersions = (queue) => async () => { const v = queue.shift(); if (v instanceof Error) throw v; return v; };

test('版本不變不通知；版本改變只通知一次', async () => {
  const seen = [];
  const checker = createUpdateChecker({ fetchVersion: fakeVersions(['v1', 'v1', 'v2', 'v3']), onUpdate: (v) => seen.push(v) });
  await checker.start();
  await checker.check();
  assert.deepEqual(seen, []);
  await checker.check();
  assert.deepEqual(seen, ['v2']);
  // 已通知過就不再重複（避免橫幅一直閃）
  await checker.check();
  assert.deepEqual(seen, ['v2']);
});

test('初始版本取不到時，之後第一次成功視為基準，不誤報', async () => {
  const seen = [];
  const checker = createUpdateChecker({ fetchVersion: fakeVersions([new Error('offline'), 'v1', 'v1', 'v2']), onUpdate: (v) => seen.push(v) });
  await checker.start();
  await checker.check(); // v1 成為基準
  await checker.check(); // v1
  assert.deepEqual(seen, []);
  await checker.check(); // v2
  assert.deepEqual(seen, ['v2']);
});

test('中途取版本失敗靜默略過；空版本不當成更新', async () => {
  const seen = [];
  const checker = createUpdateChecker({ fetchVersion: fakeVersions(['v1', new Error('502'), '', null, 'v1']), onUpdate: (v) => seen.push(v) });
  await checker.start();
  for (let i = 0; i < 4; i++) await checker.check();
  assert.deepEqual(seen, []);
});

test('更新橫幅：兩種語系文案、重新載入鈕觸發 onReload', () => {
  const zh = renderUpdateBanner('zh-TW');
  assert.match(zh, /網站已更新/);
  assert.match(zh, /id="update-reload"/);
  assert.match(renderUpdateBanner('en'), /updated/i);
  // 以最小假 DOM 驗證綁定：querySelector 回傳可 addEventListener 的物件
  let handler = null, reloaded = 0;
  const root = { querySelector: (sel) => sel === '#update-reload' ? { addEventListener: (_, fn) => { handler = fn; } } : null };
  bindUpdateBanner(root, { onReload: () => reloaded++ });
  handler();
  assert.equal(reloaded, 1);
});
