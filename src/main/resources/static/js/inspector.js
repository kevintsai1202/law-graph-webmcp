import { TOOL_DEFS } from './webmcp.js';
import { esc, mount } from './views/util.js';
import { ICONS } from './views/icons.js';

/** 折疊式 Tool Inspector：顯示目前頁面狀態與該狀態實際可執行的工具。 */
export function mountInspector(root, webmcp, t, getLocale) {
  const host = document.createElement('aside');
  host.id = 'inspector'; host.className = 'inspector collapsed';
  root.body.appendChild(host);

  /** 產生 fillQuestions 的可編輯 JSON 範例，讓使用者不必猜 questionId。 */
  const inputTemplate = (name, current) => {
    if (name !== 'fillQuestions' || current.view !== 'QUESTIONS') return '{}';
    const guide = webmcp.questionGuide?.();
    return JSON.stringify(guide?.fillQuestionsExample || { answers: [] }, null, 2);
  };

  /** 顯示目前等待回答的題目、編號與提問原因。 */
  const renderQuestionGuide = (current, locale) => {
    if (current.view !== 'QUESTIONS') return '';
    const guide = webmcp.questionGuide?.();
    if (!guide?.questions?.length) return '';
    const title = locale === 'zh-TW' ? '題目對照：用 questionId 填答' : 'Question map: fill by questionId';
    const hint = locale === 'zh-TW'
      ? '先閱讀題目，再選取 fillQuestions；下方 JSON 會自動帶入正確的 questionId。'
      : 'Read the questions first, then select fillQuestions; its JSON template uses the exact questionId values.';
    const items = guide.questions.map((question) => `<li><code>${esc(question.questionId)}</code> ${esc(question.question)}<small>${esc(locale === 'zh-TW' ? '提問原因' : 'Why')}: ${esc(question.why)}${question.filled ? ` · ${esc(locale === 'zh-TW' ? '已填' : 'filled')}` : ''}</small></li>`).join('');
    return `<section id="insp-question-guide" class="insp-guide"><strong>${esc(title)}</strong><p>${esc(hint)}</p><ol>${items}</ol></section>`;
  };

  /** 重繪：下拉選單只放目前狀態可用的工具，避免誤執行 inactive 工具。 */
  const draw = () => {
    const locale = getLocale();
    const active = new Set(webmcp.tools());
    const current = webmcp.pageStatus?.() || { view: 'INPUT', status: 'NONE', nextAction: '' };
    const availableDefs = TOOL_DEFS.filter((d) => active.has(d.name));
    const opts = availableDefs.length
      ? availableDefs.map((d) => `<option value="${d.name}">${d.name}</option>`).join('')
      : '<option value="" disabled>No tools available</option>';
    const stateText = locale === 'zh-TW'
      ? `目前狀態：${current.view}（${current.status}）`
      : `Page state: ${current.view} (${current.status})`;
    const toolsText = locale === 'zh-TW' ? '目前可用工具：' : 'Available tools: ';
    const firstTool = availableDefs[0]?.name || '';
    const guide = renderQuestionGuide(current, locale);
    host.dataset.view = current.view;
    const wasOpen = !host.classList.contains('collapsed');
    mount(host, `<button id="insp-toggle" type="button" aria-expanded="${wasOpen}" aria-controls="insp-body"><span>${esc(t('inspector.title', locale))} (${active.size}/${TOOL_DEFS.length})</span>${ICONS.chevronDown}</button>
      <div class="insp-body" id="insp-body"><p id="insp-state">${esc(stateText)}</p><p id="insp-tools">${esc(toolsText)}${availableDefs.map((d) => esc(d.name)).join(', ') || '—'}</p>${guide}<select id="insp-tool" aria-label="Tool">${opts}</select><textarea id="insp-input" rows="${firstTool === 'fillQuestions' ? '8' : '3'}" aria-label="Input JSON">${esc(inputTemplate(firstTool, current))}</textarea>
      <button id="insp-run" type="button" class="primary">${esc(t('inspector.run', locale))}</button><pre id="insp-out"></pre></div>`);
    host.classList.toggle('collapsed', !wasOpen);
    const toggle = host.querySelector('#insp-toggle');
    toggle.addEventListener('click', () => { const open = host.classList.toggle('collapsed') === false; toggle.setAttribute('aria-expanded', String(open)); });
    host.querySelector('#insp-tool').addEventListener('change', (event) => {
      host.querySelector('#insp-input').value = inputTemplate(event.target.value, current);
    });
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
