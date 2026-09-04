import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebMcpBoot } from '../src/main/resources/static/js/webmcpBoot.js';
import { TOOL_NAMES_BY_VIEW } from '../src/main/resources/static/js/webmcp.js';

/** 假 host：記錄 registerTool 並支援 abort 解除。 */
function fakeHost() {
  const tools = new Map();
  return {
    tools,
    registerTool: async (tool, opts) => { tools.set(tool.name, tool); opts?.signal?.addEventListener('abort', () => tools.delete(tool.name)); }
  };
}

// 用途：webmcp-bundle.js 於 <head> 先載入時，app 尚未存在也要先把 INPUT 工具註冊給 host；bind 後 execute 才真正執行。
test('boot：app 綁定前即向既有 host 註冊 INPUT 工具', async () => {
  const host = fakeHost();
  const boot = createWebMcpBoot({ runtime: { document: { modelContext: host } } });
  await boot.initialRegistration();
  assert.deepEqual([...host.tools.keys()].sort(), [...TOOL_NAMES_BY_VIEW.INPUT].sort());
  assert.equal(boot.isBound(), false);
  boot.stop();
});
test('boot：markReady 前 execute 等待，之後轉發到真 app', async () => {
  const host = fakeHost();
  const boot = createWebMcpBoot({ runtime: { document: { modelContext: host } } });
  await boot.initialRegistration();
  let done = false;
  const pending = host.tools.get('getOutputOptions').execute({}).then((r) => { done = true; return r; });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false);
  const app = { getState: () => ({ view: 'INPUT' }), getLocale: () => 'en', getOutputOptions: () => ({ ok: true, count: 9 }) };
  const webmcp = boot.bind(app, {});
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false, 'bind 後、mount 完成前仍不得執行');
  boot.markReady();
  assert.equal((await pending).count, 9);
  assert.equal(boot.isBound(), true);
  assert.equal(webmcp.hasHost(), true);
  boot.stop();
});
test('boot：host 晚注入時補註冊並通知 onHost', async () => {
  const runtime = { document: {} };
  const boot = createWebMcpBoot({ runtime, watchOptions: { intervalMs: 5, timeoutMs: 500 } });
  const seen = [];
  boot.onHost((v) => seen.push(v));
  boot.bind({ getState: () => ({ view: 'INPUT' }), getLocale: () => 'en' }, {});
  boot.markReady();
  const host = fakeHost();
  runtime.document.modelContext = host;
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(seen, [true]);
  assert.ok(host.tools.has('startCase'));
  boot.stop();
});
