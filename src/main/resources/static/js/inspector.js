import { TOOL_DEFS } from './webmcp.js';
import { esc, mount } from './views/util.js';
import { ICONS } from './views/icons.js';

/** localStorage 旗標鍵：曾以 ?inspector=1 開啟過就記住，之後不必每次帶參數。 */
const FLAG_KEY = 'lawgraph.inspector';

/**
 * 是否顯示工具檢視器。它是給 Agent 開發者核對「此頁面狀態下 Agent 看得到哪些工具」的除錯面板，
 * 對一般使用者只是右下角一塊遮住內容的浮框，因此預設隱藏。
 * 開啟方式：網址 query 或 hash 帶 inspector=1（會寫入 localStorage 記住）；inspector=0 關閉並清除記錄。
 * 參數可注入（測試用）：loc 需有 search／hash，storage 需有 getItem／setItem／removeItem。
 */
export function inspectorEnabled(loc = location, storage = localStorage) {
  const params = new URLSearchParams(`${loc.search || ''}&${(loc.hash || '').split('?')[1] || ''}`.replace(/^&/, ''));
  const flag = params.get('inspector');
  try {
    if (flag === '1') { storage.setItem(FLAG_KEY, '1'); return true; }
    if (flag === '0') { storage.removeItem?.(FLAG_KEY); return false; }
    return storage.getItem(FLAG_KEY) === '1';
  } catch { return flag === '1'; }
}

/**
 * 折疊式 Tool Inspector（唯讀）：只顯示目前頁面狀態與該狀態下 Agent 可用的 WebMCP 工具清單，
 * 不提供直接執行——工具一律由 Agent 經 WebMCP 層呼叫，人只透過頁面本身操作。
 * 面板一律掛進 DOM（E2E 以 DOM 內容核對工具清單），但只有 inspectorEnabled() 為真時才可見。
 */
export function mountInspector(root, webmcp, t, getLocale) {
  const host = document.createElement('aside');
  host.id = 'inspector'; host.className = 'inspector collapsed';
  host.hidden = !inspectorEnabled();
  root.body.appendChild(host);

  /** 重繪：狀態列＋可用工具清單（名稱、唯讀標記、描述）。 */
  const draw = () => {
    const locale = getLocale();
    const active = new Set(webmcp.tools());
    const current = webmcp.pageStatus?.() || { view: 'INPUT', status: 'NONE', nextAction: '' };
    const availableDefs = TOOL_DEFS.filter((d) => active.has(d.name));
    const stateText = locale === 'zh-TW'
      ? `目前狀態：${current.view}（${current.status}）`
      : `Page state: ${current.view} (${current.status})`;
    const roText = locale === 'zh-TW' ? '唯讀' : 'read-only';
    const emptyText = locale === 'zh-TW' ? '目前狀態沒有可用工具' : 'No tools available in this state';
    const items = availableDefs.map((d) =>
      `<li><code>${esc(d.name)}</code>${d.annotations?.readOnlyHint ? `<span class="insp-ro">${esc(roText)}</span>` : ''}<small>${esc(d.description)}</small></li>`).join('');
    host.dataset.view = current.view;
    const wasOpen = !host.classList.contains('collapsed');
    mount(host, `<button id="insp-toggle" type="button" aria-expanded="${wasOpen}" aria-controls="insp-body"><span>${esc(t('inspector.title', locale))} (${active.size}/${TOOL_DEFS.length})</span>${ICONS.chevronDown}</button>
      <div class="insp-body" id="insp-body"><p id="insp-state">${esc(stateText)}</p>
      <ul id="insp-list">${items || `<li class="insp-empty">${esc(emptyText)}</li>`}</ul>
      <p class="insp-note">${esc(t('inspector.readonly', locale))}</p></div>`);
    host.classList.toggle('collapsed', !wasOpen);
    const toggle = host.querySelector('#insp-toggle');
    toggle.addEventListener('click', () => { const open = host.classList.toggle('collapsed') === false; toggle.setAttribute('aria-expanded', String(open)); });
  };
  draw();
  return { refresh: draw };
}
