import { t, detectLocale, DICT } from './i18n.js';
import { States, reduce, initialState } from './state.js';
import { esc, mount as mountHtml } from './views/util.js';
import { renderInput, bindInput } from './views/input.js';
import { renderProgress, renderCancel } from './views/progress.js';
import { renderQuestions, bindQuestions } from './views/questions.js';
import { renderResult, bindResult } from './views/result.js';

/** 應用程式核心：持有狀態、驅動輪詢、切換 view；WebMCP 由 webmcp.js 透過 onChange 掛上。 */
export function createApp({ root, client, storage, navigatorLanguage }) {
  /** 目前頁面狀態（state.js 的 reduce 產生）。 */
  let state = { ...initialState };
  /** 目前語系；使用者選過的存於 storage。 */
  let locale = detectLocale(navigatorLanguage, storage.getItem('locale'));
  /** 目前語系的示範案例清單。 */
  let samples = [];
  /** 停止輪詢的函式；無輪詢時為 null。 */
  let stopPolling = null;
  /** 結果頁目前分頁。 */
  let activeTab = 'graph';
  /** onChange 訂閱者：(state, kind) => void；kind 為 'STATE' 或 'RESULT_RENDERED'。 */
  const listeners = new Set();
  const stage = () => root.querySelector('#stage');

  /** 送事件進狀態機、重繪並通知訂閱者。 */
  function dispatch(event) {
    state = reduce(state, event);
    render();
    listeners.forEach((l) => l(state, 'STATE'));
  }

  /** 依 view 渲染並綁事件；[data-i18n] 節點同步換字。 */
  function render() {
    const el = stage(); if (!el) return;
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n, locale); });
    switch (state.view) {
      case States.INPUT:
        mountHtml(el, renderInput({ samples }, locale));
        bindInput(el, { onSubmit: start, onSample: startSample });
        break;
      case States.RUNNING:
        mountHtml(el, renderProgress({ step: state.last?.step || 'BRAINSTORM' }, locale) + renderCancel(locale));
        bindCancel(el);
        break;
      case States.QUESTIONS:
        mountHtml(el, renderProgress({ step: 'QUESTIONS' }, locale) + renderQuestions({ questions: state.last.questions }, locale) + renderCancel(locale));
        bindQuestions(el, { onSubmit: answer });
        bindCancel(el);
        break;
      case States.RESULT:
        mountHtml(el, renderResult({ status: state.last, activeTab }, locale));
        bindResult(el, { onTab: (k) => { activeTab = k; render(); }, onNewCase: reset });
        listeners.forEach((l) => l(state, 'RESULT_RENDERED'));
        break;
      case States.FAILED:
        mountHtml(el, renderFailed(state.last?.error, locale));
        el.querySelector('#retry').addEventListener('click', reset);
        break;
    }
  }

  /** 進行中／等待回答頁的「放棄此案」按鈕：停止輪詢並回輸入頁。 */
  function bindCancel(el) {
    el.querySelector('#cancel-case')?.addEventListener('click', reset);
  }

  /** 失敗頁：錯誤代碼、步驤、訊息與重試。 */
  function renderFailed(error, loc) {
    return `<section class="failed"><h2>${esc(t('failed.title', loc))}</h2>
      <p class="code">${esc(error?.code || '')} @ ${esc(error?.step || '')}</p><p>${esc(error?.message || '')}</p>
      <button id="retry" type="button" class="primary">${esc(t('failed.retry', loc))}</button></section>`;
  }

  /** 開始（或重新開始）輪詢指定案件。 */
  function beginPolling(caseId) {
    if (stopPolling) stopPolling();
    stopPolling = client.poll(caseId, (s) => dispatch({ type: 'STATUS', status: s }));
  }

  /** 啟動新案件；回傳 CaseStatus（空白文字回 null）。 */
  async function start(text) {
    if (!text || !text.trim()) return null;
    const s = await client.start(text.trim(), locale);
    storage.setItem('caseId', s.caseId);
    dispatch({ type: 'START', caseId: s.caseId });
    beginPolling(s.caseId);
    return s;
  }

  /** 以示範案例 id 啟動；找不到回 null。 */
  async function startSample(id) {
    const smp = samples.find((x) => x.id === id);
    return smp ? start(smp.text) : null;
  }

  /** 送出回答並續接輪詢。 */
  async function answer(answers) {
    const s = await client.answer(state.caseId, answers);
    dispatch({ type: 'STATUS', status: s });
    beginPolling(state.caseId);
    return s;
  }

  /** 捨棄目前案件，回到輸入頁。 */
  function reset() {
    if (stopPolling) stopPolling();
    stopPolling = null;
    storage.removeItem('caseId');
    activeTab = 'graph';
    dispatch({ type: 'RESET' });
  }

  /** 切換語系：存起來、重載示範案例、重繪。 */
  async function setLocale(code) {
    locale = code in DICT ? code : 'en';
    storage.setItem('locale', locale);
    samples = await client.samples(locale);
    const sel = root.querySelector('#lang-select'); if (sel) sel.value = locale;
    listeners.forEach((l) => l(state, 'LOCALE'));
    render();
  }

  /** 掛載：語系選單、載示範案例、續接進行中的 case。 */
  async function mount() {
    const sel = root.querySelector('#lang-select');
    sel.value = locale;
    sel.addEventListener('change', () => setLocale(sel.value));
    samples = await client.samples(locale).catch(() => []);
    const saved = storage.getItem('caseId');
    if (saved) { dispatch({ type: 'START', caseId: saved }); beginPolling(saved); } else render();
  }

  return {
    mount, dispatch, getState: () => state, getLocale: () => locale, getSamples: () => samples,
    setLocale, start, startSample, answer, reset,
    verify: (ref) => client.verify(ref),
    onChange: (l) => listeners.add(l)
  };
}
