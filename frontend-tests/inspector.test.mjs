import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectorEnabled } from '../src/main/resources/static/js/inspector.js';

// 用途：工具檢視器是給 Agent 開發者看的，一般使用者預設看不到；只有網址帶 inspector=1 或曾開啟過（localStorage）才顯示。
const storage = (v) => ({ getItem: () => v, setItem() {} });
test('inspectorEnabled：預設關閉，網址參數或 localStorage 旗標才開', () => {
  assert.equal(inspectorEnabled({ search: '', hash: '#/' }, storage(null)), false);
  assert.equal(inspectorEnabled({ search: '?inspector=1', hash: '#/' }, storage(null)), true);
  assert.equal(inspectorEnabled({ search: '', hash: '#/stats?inspector=1' }, storage(null)), true);
  assert.equal(inspectorEnabled({ search: '', hash: '#/' }, storage('1')), true);
  assert.equal(inspectorEnabled({ search: '?inspector=0', hash: '' }, storage('1')), false);
});
