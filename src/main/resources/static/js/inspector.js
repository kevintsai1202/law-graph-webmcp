import { TOOL_DEFS } from './webmcp.js';
import { esc, mount } from './views/util.js';
import { ICONS } from './views/icons.js';

/**
 * 折疊式 Tool Inspector（唯讀）：只顯示目前頁面狀態與該狀態下 Agent 可用的 WebMCP 工具清單，
 * 不提供直接執行——工具一律由 Agent 經 WebMCP 層呼叫，人只透過頁面本身操作。
 */
export function mountInspector(root, webmcp, t, getLocale) {
  const host = document.createElement('aside');
  host.id = 'inspector'; host.className = 'inspector collapsed';
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
