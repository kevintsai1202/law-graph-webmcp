import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphAssetLoader } from '../src/main/resources/static/js/graphAssets.js';

/** 模擬腳本節點，控制實際載入完成或失敗的時間。 */
function fixture(timeoutMs = 100) {
  const runtime = {};
  const scripts = [];
  const doc = { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild(script) { scripts.push(script); } } };
  return { runtime, scripts, load: createGraphAssetLoader({ doc, runtime, timeoutMs }) };
}

test('只按需載入、同時呼叫共用下載，且依序等待相依套件', async () => {
  const f = fixture();
  assert.equal(f.scripts.length, 0);
  const pending = f.load();
  assert.equal(f.load(), pending);
  for (const [i, name] of ['THREE', 'SpriteText', 'ForceGraph3D'].entries()) {
    assert.equal(f.scripts.length, i + 1);
    f.runtime[name] = {};
    f.scripts[i].onload();
    await Promise.resolve();
  }
  await pending;
  await f.load();
  assert.equal(f.scripts.length, 3);
});

test('載入錯誤可重試，已完成的相依套件不重複下載', async () => {
  const f = fixture();
  f.runtime.THREE = {};
  const failed = f.load();
  await Promise.resolve();
  f.scripts[0].onerror();
  await assert.rejects(failed, /Unable to load/);
  assert.equal(f.scripts[0].removed, true);
  const retry = f.load();
  await Promise.resolve();
  f.runtime.SpriteText = {};
  f.scripts[1].onload();
  await Promise.resolve();
  f.runtime.ForceGraph3D = {};
  f.scripts[2].onload();
  await retry;
});

test('永不回應的腳本有逾時，不會讓結果畫面永久等待', async () => {
  const f = fixture(15);
  await assert.rejects(f.load(), /timed out/);
  assert.equal(f.scripts[0].removed, true);
});
