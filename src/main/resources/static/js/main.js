import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';

/** 瀏覽器入口：注入真實依賴並掛載；暴露到 window 供 webmcp.js／inspector.js／E2E 使用。 */
const app = createApp({
  root: document,
  client: createCaseClient(fetch.bind(globalThis)),
  storage: window.sessionStorage,
  navigatorLanguage: navigator.language
});
window.__lawGraphApp = app;
await app.mount();
