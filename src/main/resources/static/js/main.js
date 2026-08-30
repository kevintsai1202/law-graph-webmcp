import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';
import * as graphView from './graphView.js';

/** 瀏覽器入口：注入真實依賴並掛載；暴露到 window 供 webmcp.js／inspector.js／E2E 使用。 */
const app = createApp({
  root: document,
  client: createCaseClient(fetch.bind(globalThis)),
  storage: window.sessionStorage,
  navigatorLanguage: navigator.language
});
window.__lawGraphApp = app;
window.__graphView = graphView;

/** 結果頁每次重繪（含分頁切回 Graph）後重新渲染 3D 圖。 */
app.onChange((state, kind) => {
  if (kind === 'RESULT_RENDERED' && state.last?.result?.graph && document.getElementById('network-canvas')) {
    graphView.render(state.last.result.graph);
  }
});

await app.mount();
