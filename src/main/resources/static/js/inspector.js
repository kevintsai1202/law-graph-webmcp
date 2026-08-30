import { TOOL_DEFS } from './webmcp.js';
import { esc, mount } from './views/util.js';
import { ICONS } from './views/icons.js';

/** 折疊式 Tool Inspector：沒有 WebMCP 的瀏覽器也能手動執行十個工具看回傳。getLocale 每次重繪時呼叫，跟隨語系切換。 */
export function mountInspector(root, webmcp, t, getLocale) {
  const host = document.createElement('aside');
  host.id = 'inspector'; host.className = 'inspector collapsed';
  root.body.appendChild(host);

  /** 重繪：未註冊（尚未 COMPLETED）的工具顯示 inactive 但仍可從 Inspector 執行以便除錯。 */
  const draw = () => {
    const locale = getLocale();
    const active = new Set(webmcp.tools());
    const opts = TOOL_DEFS.map((d) => `<option value="${d.name}">${d.name}${active.has(d.name) ? '' : ' (inactive)'}</option>`).join('');
    const wasOpen = !host.classList.contains('collapsed');
    mount(host, `<button id="insp-toggle" type="button" aria-expanded="${wasOpen}" aria-controls="insp-body"><span>${esc(t('inspector.title', locale))} (${active.size}/${TOOL_DEFS.length})</span>${ICONS.chevronDown}</button>
      <div class="insp-body" id="insp-body"><select id="insp-tool" aria-label="Tool">${opts}</select><textarea id="insp-input" rows="3" aria-label="Input JSON">{}</textarea>
      <button id="insp-run" type="button" class="primary">${esc(t('inspector.run', locale))}</button><pre id="insp-out"></pre></div>`);
    host.classList.toggle('collapsed', !wasOpen);
    const toggle = host.querySelector('#insp-toggle');
    toggle.addEventListener('click', () => { const open = host.classList.toggle('collapsed') === false; toggle.setAttribute('aria-expanded', String(open)); });
    host.querySelector('#insp-run').addEventListener('click', async () => {
      const out = host.querySelector('#insp-out');
      const name = host.querySelector('#insp-tool').value;
      let input = {};
      try { input = JSON.parse(host.querySelector('#insp-input').value || '{}'); } catch { out.textContent = 'invalid JSON'; return; }
      try { out.textContent = JSON.stringify(await webmcp.execute(name, input), null, 2); }
      catch (e) { out.textContent = 'error: ' + e.message; }
    });
  };
  draw();
  return { refresh: draw };
}
