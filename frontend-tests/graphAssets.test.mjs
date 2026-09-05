import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphAssetLoader, shouldPreloadGraphAssets } from '../src/main/resources/static/js/graphAssets.js';

/** 模擬腳本節點，控制實際載入完成或失敗的時間。 */
function fixture(timeoutMs = 100) {
  const runtime = {};
  const scripts = [];
  const doc = { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild(script) { scripts.push(script); } } };
  return { runtime, scripts, load: createGraphAssetLoader({ doc, runtime, timeoutMs }) };
}

test('只按需載入、同時呼叫共用下載；three 與 3d-force-graph 平行下載，spritetext 等 THREE 就緒後才載', async () => {
  const f = fixture();
  assert.equal(f.scripts.length, 0);
  const pending = f.load();
  assert.equal(f.load(), pending);
  // 兩個大檔一起插入（3d-force-graph 自帶 three，不依賴全域 THREE）
  assert.deepEqual(f.scripts.map((s) => s.src), ['/vendor/three.min.js', '/vendor/3d-force-graph.min.js']);
  // three-spritetext 執行時就需要全域 THREE，必須等 three 載完才插入；動態 script 不可用 async=false（移除掉的停滯腳本會永久卡住後續依序腳本）
  assert.ok(f.scripts.every((s) => s.async !== false));
  f.runtime.THREE = {};
  f.scripts[0].onload();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.scripts.length, 3);
  assert.equal(f.scripts[2].src, '/vendor/three-spritetext.min.js');
  f.runtime.ForceGraph3D = {};
  f.scripts[1].onload();
  f.runtime.SpriteText = {};
  f.scripts[2].onload();
  await pending;
  await f.load();
  assert.equal(f.scripts.length, 3);
});

test('單一腳本逾時會自動重試一次，並以查詢字串避開卡住的連線', async () => {
  const f = fixture(15);
  f.runtime.THREE = {}; f.runtime.SpriteText = {};
  const pending = f.load();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.scripts.length, 1);
  // 第一次不回應 → 逾時後應移除節點並重插一個帶查詢字串的節點
  await new Promise((r) => setTimeout(r, 22));
  assert.equal(f.scripts[0].removed, true);
  assert.equal(f.scripts.length, 2);
  assert.match(f.scripts[1].src, /^\/vendor\/3d-force-graph\.min\.js\?retry=1$/);
  f.runtime.ForceGraph3D = {};
  f.scripts[1].onload();
  await pending;
});

test('載入錯誤也重試一次；連續兩次錯誤才拒絕，之後重新呼叫只補下載缺少的套件', async () => {
  const f = fixture();
  f.runtime.THREE = {}; f.runtime.ForceGraph3D = {};
  const failed = f.load();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, '/vendor/three-spritetext.min.js');
  f.scripts[0].onerror();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.scripts.length, 2);
  assert.equal(f.scripts[1].src, '/vendor/three-spritetext.min.js?retry=1');
  f.scripts[1].onerror();
  await assert.rejects(failed, /Unable to load/);
  assert.ok(f.scripts.every((s) => s.removed));
  // 再呼叫：只剩 SpriteText 需要下載，且從乾淨網址重來
  const retry = f.load();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.scripts.length, 3);
  assert.equal(f.scripts[2].src, '/vendor/three-spritetext.min.js');
  f.runtime.SpriteText = {};
  f.scripts[2].onload();
  await retry;
});

test('永不回應的腳本重試一次後仍逾時就拒絕，不會讓結果畫面永久等待', async () => {
  const f = fixture(15);
  f.runtime.THREE = {}; f.runtime.SpriteText = {};
  await assert.rejects(f.load(), /timed out/);
  assert.equal(f.scripts.length, 2);
  assert.ok(f.scripts.every((s) => s.removed));
});

test('案件送出後（RUNNING／QUESTIONS）就該預載 3D 套件，首頁／輸入頁／統計頁不預載', () => {
  assert.equal(shouldPreloadGraphAssets({ view: 'RUNNING', caseId: 'c1' }), true);
  assert.equal(shouldPreloadGraphAssets({ view: 'QUESTIONS', caseId: 'c1' }), true);
  assert.equal(shouldPreloadGraphAssets({ view: 'RESULT', caseId: 'c1' }), true);
  assert.equal(shouldPreloadGraphAssets({ view: 'RUNNING', caseId: null }), false);
  assert.equal(shouldPreloadGraphAssets({ view: 'HOME' }), false);
  assert.equal(shouldPreloadGraphAssets({ view: 'INPUT' }), false);
  assert.equal(shouldPreloadGraphAssets({ view: 'STATS', caseId: 'c1' }), false);
  assert.equal(shouldPreloadGraphAssets({ view: 'FAILED', caseId: 'c1' }), false);
});
