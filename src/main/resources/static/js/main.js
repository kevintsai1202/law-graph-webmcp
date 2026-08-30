import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';
import { t } from './i18n.js';
import * as graphView from './graphView.js';
import { createWebMcp } from './webmcp.js';
import { mountInspector } from './inspector.js';

/** 瀏覽器入口：注入真實依賴並掛載；暴露到 window 供 E2E 與 console 除錯使用。 */
const app = createApp({
  root: document,
  client: createCaseClient(fetch.bind(globalThis)),
  storage: window.sessionStorage,
  navigatorLanguage: navigator.language
});
window.__lawGraphApp = app;
window.__graphView = graphView;

/** WebMCP 控制器：有 document.modelContext 才會真的註冊；Inspector 一律可用。 */
const webmcp = createWebMcp({ app, graphView, modelContext: document.modelContext });
const badge = document.getElementById('agent-badge');
const hasWebMcp = !!document.modelContext?.registerTool;
badge.dataset.i18n = hasWebMcp ? 'agent.available' : 'agent.unavailable';
badge.classList.toggle('on', hasWebMcp);
await webmcp.registerBase();
const inspector = mountInspector(document, webmcp, t, app.getLocale());

/** 狀態變化：結果頁重繪 → 渲染 3D 圖並補註冊圖工具；回到輸入頁 → 解除圖工具只留 base。 */
app.onChange(async (state, kind) => {
  if (kind === 'RESULT_RENDERED') {
    if (state.last?.result?.graph && document.getElementById('network-canvas')) graphView.render(state.last.result.graph);
    await webmcp.registerCompleted();
    inspector.refresh();
  }
  if (kind === 'STATE' && state.view === 'INPUT' && webmcp.tools().length > 5) {
    webmcp.unregisterAll();
    await webmcp.registerBase();
    inspector.refresh();
  }
});
window.addEventListener('pagehide', () => webmcp.unregisterAll(), { once: true });

await app.mount();
