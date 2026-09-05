import { createApp } from './app.js';
import { createCaseClient } from './caseClient.js';
import { t } from './i18n.js';
import * as graphView from './graphView.js';
import { createWebMcpBoot } from './webmcpBoot.js';
import { mountInspector } from './inspector.js';
import { renderLogin, bindLogin, renderPrivacyNotice, bindPrivacy } from './login.js';
import { createGraphAssetLoader, shouldPreloadGraphAssets } from './graphAssets.js';
import { createUpdateChecker } from './updateCheck.js';
import { renderUpdateBanner, bindUpdateBanner } from './views/updateBanner.js';

/** 只有顯示結果圖時才下載 3D 套件。 */
const loadGraphAssets = createGraphAssetLoader();
/** 重繪序號：舊載入結果不可覆蓋切頁後的新畫布。 */
let graphRenderId = 0;
/** 載入圖形依賴並渲染；失敗保留其他結果分頁並提供明確提示。 */
async function renderGraph(data) {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const requestId = ++graphRenderId;
  canvas.textContent = app.getLocale() === 'zh-TW' ? '正在載入關聯圖…' : 'Loading graph…';
  try {
    await loadGraphAssets();
    if (requestId !== graphRenderId || document.getElementById('network-canvas') !== canvas) return;
    graphView.render(data);
  } catch (error) {
    if (requestId !== graphRenderId || document.getElementById('network-canvas') !== canvas) return;
    canvas.textContent = app.getLocale() === 'zh-TW'
      ? '關聯圖載入失敗，請重新整理後再試。其他結果分頁仍可閱讀。'
      : 'The graph could not load. Refresh to retry; other result tabs remain available.';
    canvas.setAttribute('role', 'alert');
    console.error('Graph loading failed', error);
  }
}

/** 瀏覽器入口：注入真實依賴並掛載；暴露到 window 供 E2E 與 console 除錯使用。 */
const app = createApp({
  root: document,
  client: createCaseClient(fetch.bind(globalThis)),
  storage: window.sessionStorage,
  navigatorLanguage: navigator.language
});
window.__lawGraphApp = app;
window.__graphView = graphView;
// Inspector 已改唯讀；E2E 與 console 除錯改由此入口直接呼叫 WebMCP 工具

graphView.setLocale(app.getLocale());

/**
 * WebMCP 控制器：優先沿用 webmcp-bundle.js 在 <head> 早期建立的啟動器（工具已先註冊給 host），
 * 這裡只把真正的 app／graphView 綁上；若該 bundle 未載入（例如只載 app-bundle.js 的舊頁面）則就地建立。
 */
const boot = window.__webmcpBoot || createWebMcpBoot({ runtime: globalThis });
window.__webmcpBoot = boot;
const webmcp = boot.bind(app, graphView);
window.__webmcp = webmcp;
const badge = document.getElementById('agent-badge');
const authSlot = document.getElementById('auth-slot');
const privacySlot = document.getElementById('privacy-slot');
/** 最近一次 /api/me 結果；null 代表尚未取得或失敗（視為未啟用）。 */
let me = null;

/** 更新右上角登入區：登入好處的次數來自 /api/quota 的 memberLimit。所有動態文字都已在 renderLogin 內 esc。 */
const updateLoginSlot = () => {
  if (!authSlot) return;
  authSlot.replaceChildren();
  authSlot.insertAdjacentHTML('afterbegin', renderLogin(me, app.getQuota?.(), app.getLocale()));
  bindLogin(authSlot, {
    // 刪除帳號：先確認，再呼叫 API，失敗提示訊息、成功則整頁重載回到未登入狀態
    onDelete: async () => {
      if (!globalThis.confirm?.(t('privacy.deleteConfirm', app.getLocale()))) return;
      try {
        await app.client.deleteMe();
      } catch (e) {
        // e 可能不是 Error（例如 reject 一個字串），沒有訊息時退回統計頁共用的錯誤文案
        globalThis.alert?.(e?.message || t('stats.error', app.getLocale()));
        return;
      }
      location.reload();
    }
  });
  if (privacySlot) {
    privacySlot.replaceChildren();
    privacySlot.insertAdjacentHTML('afterbegin', renderPrivacyNotice(me, app.getLocale()));
    bindPrivacy(privacySlot, {
      // 我知道了：呼叫後端記下已告知（失敗也不擋 UI），本地立即隱藏告知卡
      onAck: async () => {
        try { await app.client.ackNotice(); } catch { /* 後端失敗不擋前端已知悉狀態 */ }
        me = { ...me, firstLogin: false };
        updateLoginSlot();
      }
    });
  }
};

/** 讀取登入身分後重繪登入區；失敗不影響其他功能。 */
const refreshMe = async () => {
  try { me = await app.client?.me?.(); } catch { me = null; }
  updateLoginSlot();
};
const semanticBadge = document.getElementById('semantic-badge');

/** 更新右上角語意檢索 MCP 授權徽章。 */
const updateSemanticBadge = () => {
  if (!semanticBadge) return;
  const auth = app.getAuthStatus();
  if (!auth || !auth.enabled) {
    semanticBadge.style.display = 'none';
    return;
  }
  semanticBadge.style.display = '';
  semanticBadge.classList.toggle('on', auth.authorized);
  semanticBadge.classList.toggle('warn', !auth.authorized);
  if (auth.authorized) {
    semanticBadge.textContent = t('auth.semantic.ready', app.getLocale());
  } else {
    const link = document.createElement('a');
    link.href = auth.startPath || '/api/auth/tw-legal-rag/start';
    link.textContent = `${t('auth.semantic.required', app.getLocale())} (${t('auth.semantic.action', app.getLocale())})`;
    semanticBadge.replaceChildren(link);
  }
};

/** 更新右上角 Agent 工具徽章（含即時換字，不等下一次 render）。 */
const setBadge = (available) => {
  badge.dataset.i18n = available ? 'agent.available' : 'agent.unavailable';
  badge.classList.toggle('on', available);
  badge.textContent = t(badge.dataset.i18n, app.getLocale());
};
setBadge(webmcp.hasHost());
// Agent host（如 ChatGPT／Codex Site tools）可能晚於腳本才注入 modelContext；啟動器持續偵測並補註冊，這裡同步徽章
boot.onHost((available) => { setBadge(available); inspector?.refresh(); });

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
    updateSemanticBadge();
    updateLoginSlot();
    inspector?.refresh();
  }
  if (kind === 'STATE') {
    updateSemanticBadge();
    syncTools(state.view);
    // 案件送出後趁等待 LLM 的空檔背景預載 3D 套件；失敗這裡不提示，真正切到關聯圖時 renderGraph 會再試並顯示訊息
    if (shouldPreloadGraphAssets(state)) loadGraphAssets().catch(() => {});
  }
  if (kind === 'RESULT_RENDERED') {
    if (state.last?.result?.graph) await renderGraph(state.last.result.graph);
    syncTools('RESULT');
  }
});

// 先完成示範案例與既有案件的初始化，再讓 Agent 看見與當前狀態一致的工具。
// 以 async IIFE 包裝而非 top-level await：打包成 classic script（app-bundle.js）時 IIFE 格式不支援 TLA。
(async () => {
  const identityReady = refreshMe();
  await app.mount();
  updateSemanticBadge();
  await identityReady;
  updateLoginSlot();
  await syncTools(app.getState().view);
  // 示範案例與既有案件都就緒後才放行早期註冊的工具，避免 Agent 讀到尚未渲染的頁面
  boot.markReady();
  inspector = mountInspector(document, webmcp, t, () => app.getLocale());
  inspector.refresh();
  // 網站重佈偵測：版本改變時在頂欄下方顯示「網站已更新」橫幅，點重新載入才換版（不自動重載，避免打斷進行中的分析）
  const updateSlot = document.getElementById('update-slot');
  const updateChecker = createUpdateChecker({
    fetchVersion: () => app.client.version(),
    onUpdate: () => {
      if (!updateSlot) return;
      updateSlot.replaceChildren();
      updateSlot.insertAdjacentHTML('afterbegin', renderUpdateBanner(app.getLocale()));
      bindUpdateBanner(updateSlot, { onReload: () => location.reload() });
    }
  });
  // E2E 以 window.__lawGraphUpdate.check() 立即觸發比對，不必等輪詢
  window.__lawGraphUpdate = updateChecker;
  updateChecker.start();
})();
window.addEventListener('pagehide', () => boot.stop(), { once: true });
