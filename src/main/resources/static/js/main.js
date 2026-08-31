import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';
import { t } from './i18n.js';
import * as graphView from './graphView.js';
import { createWebMcp, resolveModelContext } from './webmcp.js';
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
graphView.setLocale(app.getLocale());

/** WebMCP 控制器：兼容 Chrome 149 的 navigator.modelContext 與新版 document.modelContext。 */
const modelContext = resolveModelContext();
const webmcp = createWebMcp({ app, graphView, modelContext });
const badge = document.getElementById('agent-badge');
const hasWebMcp = !!modelContext?.registerTool;
badge.dataset.i18n = hasWebMcp ? 'agent.available' : 'agent.unavailable';
badge.classList.toggle('on', hasWebMcp);

/** 將連續狀態變化排隊，避免舊狀態的工具註冊覆蓋新狀態。 */
let toolSync = Promise.resolve();
let inspector = null;
const syncTools = (view) => {
  toolSync = toolSync.then(async () => {
    await webmcp.syncForState(view);
    inspector?.refresh();
  });
  return toolSync;
};

/** 狀態變化：語系、畫面與 WebMCP 工具清單都跟著同一個 app state 更新。 */
app.onChange(async (state, kind) => {
  if (kind === 'LOCALE') {
    graphView.setLocale(app.getLocale());
    inspector?.refresh();
  }
  if (kind === 'STATE') syncTools(state.view);
  if (kind === 'RESULT_RENDERED') {
    if (state.last?.result?.graph && document.getElementById('network-canvas')) graphView.render(state.last.result.graph);
    syncTools('RESULT');
  }
});

// 先完成示範案例與既有案件的初始化，再讓 Agent 看見與當前狀態一致的工具。
await app.mount();
await syncTools(app.getState().view);
inspector = mountInspector(document, webmcp, t, () => app.getLocale());
inspector.refresh();
window.addEventListener('pagehide', () => webmcp.unregisterAll(), { once: true });
