import { createWebMcp, resolveModelContext, watchModelContext } from './webmcp.js';

/**
 * WebMCP 啟動器：讓工具在頁面最早期（webmcp-bundle.js 於 <head> 同步載入時）就註冊給 Agent host，
 * 不必等 app-bundle.js 載入、示範案例抓完才出現——部分 Agent host（ChatGPT／Codex Site tools）
 * 只在頁面載入初期掃描一次工具清單。
 * app／graphView 以惰性代理注入：bind() 之前 execute 會先等 ready，綁定後才真正執行。
 */
export function createWebMcpBoot({ runtime = globalThis, watchOptions } = {}) {
  /** 真正的應用層物件；bind() 後才有值。 */
  const refs = { app: null, graphView: null };
  /** 惰性代理：綁定前回 undefined（webmcp.js 內以 ?. 容錯），綁定後轉發到真物件。 */
  const lazy = (key) => new Proxy({}, { get: (_, prop) => refs[key]?.[prop] });
  let resolveReady;
  /** app 掛載完成（示範案例已載、首頁已渲染）的訊號；所有工具 execute 都先等它，避免早期呼叫讀到空頁面。 */
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  /** host 接上／變更時的回呼（徽章與 Inspector 更新用）。 */
  const hostListeners = new Set();

  const webmcp = createWebMcp({ app: lazy('app'), graphView: lazy('graphView'), modelContext: resolveModelContext(runtime), ready });

  /** 立刻註冊輸入頁工具（若 host 已存在）；失敗不阻斷頁面。 */
  let initial = webmcp.hasHost() ? webmcp.syncForState('INPUT').catch(() => []) : Promise.resolve([]);

  // host 晚注入：補接上並重新註冊目前狀態的工具
  const stopWatch = webmcp.hasHost() ? null : watchModelContext(runtime, async (late) => {
    await webmcp.attachModelContext(late);
    hostListeners.forEach((cb) => cb(true));
  }, watchOptions);

  return {
    webmcp,
    ready,
    /** 綁定真正的 app／graphView；回傳 webmcp 供入口程式繼續使用。工具仍要等 markReady() 才會執行。 */
    bind(app, graphView) {
      refs.app = app; refs.graphView = graphView;
      return webmcp;
    },
    /** app.mount() 完成後呼叫：放行所有等待中的工具呼叫。 */
    markReady() { resolveReady(); },
    /** 是否已綁定應用層。 */
    isBound: () => Boolean(refs.app),
    /** 初次註冊完成的 promise（測試用）。 */
    initialRegistration: () => initial,
    onHost: (cb) => { hostListeners.add(cb); return () => hostListeners.delete(cb); },
    stop() { stopWatch?.(); webmcp.unregisterAll(); }
  };
}
