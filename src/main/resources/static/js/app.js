import { t, detectLocale, DICT } from './i18n.js';
import { States, reduce, initialState } from './state.js';
import { esc, mount as mountHtml } from './views/util.js';
import { ICONS } from './views/icons.js';
import { renderInput, bindInput } from './views/input.js';
import { renderProgress, renderCancel } from './views/progress.js';
import { renderQuestions, bindQuestions } from './views/questions.js';
import { renderResult, bindResult, renderSections } from './views/result.js';

/** 應用程式核心：持有狀態、驅動輪詢、切換 view；WebMCP 由 webmcp.js 透過 onChange 掛上。 */
export function createApp({ root, client, storage, navigatorLanguage, partialCollapseMs = 5000 }) {
  /** 目前頁面狀態（state.js 的 reduce 產生）。 */
  let state = { ...initialState };
  /** 目前語系；使用者選過的存於 storage。 */
  let locale = detectLocale(navigatorLanguage, storage.getItem('locale'));
  /** 目前語系的示範案例清單。 */
  let samples = [];
  /** 停止輪詢的函式；無輪詢時為 null。 */
  let stopPolling = null;
  /** 啟動請求序號：避免使用者取消案件後，過期的網路回應把畫面切回進行中。 */
  let startRequestId = 0;
  /** 結果頁目前分頁。 */
  let activeTab = 'graph';
  /** QUESTIONS 頁的答案草稿；AI 填入後仍由人檢查並送出。 */
  let questionDraft = {};
  /** 最近一次 Agent 實際填入欄位的提示；避免只回報模擬成功但畫面沒有證據。 */
  let questionFillNotice = null;
  /** onChange 訂閱者：(state, kind) => void；kind 為 'STATE' 或 'RESULT_RENDERED'。 */
  const listeners = new Set();
  const stage = () => root.querySelector('#stage');

  /** 送事件進狀態機、重繪並通知訂閱者。 */
  function dispatch(event) {
    const nextState = reduce(state, event);
    if (nextState.view !== States.QUESTIONS) {
      questionDraft = {};
      questionFillNotice = null;
    } else if (event.type === 'STATUS') {
      const ids = new Set((nextState.last?.questions || []).map((question) => question.id));
      questionDraft = Object.fromEntries(Object.entries(questionDraft).filter(([id]) => ids.has(id)));
    }
    state = nextState;
    render();
    listeners.forEach((l) => l(state, 'STATE'));
  }

  /** 依 view 渲染並綁事件；[data-i18n] 節點同步換字。 */
  function render() {
    const el = stage(); if (!el) return;
    clearTimeout(collapseTimer);
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n, locale); });
    switch (state.view) {
      case States.INPUT:
        mountHtml(el, renderInput({ samples }, locale));
        bindInput(el, { onSubmit: start, onSample: startSample });
        break;
      case States.RUNNING:
        // 放棄按鈕緊接進度列，捲動前就看得到
        mountHtml(el, renderProgress({ step: state.last?.step || 'BRAINSTORM' }, locale) + renderCancel(locale)
          + renderSections(state.last?.result, locale));
        bindCancel(el);
        break;
      case States.QUESTIONS:
        // 頭腦風暴成果放在提問之前（先看脈絡再回答），數秒後自動收折讓問題浮上來
        mountHtml(el, renderProgress({ step: 'QUESTIONS', busy: false }, locale) + renderCancel(locale) + renderSections(state.last.result, locale)
          + renderQuestions({ questions: state.last.questions, answers: questionDraft, notice: questionFillNotice }, locale));
        bindQuestions(el, { onSubmit: answer });
        bindCancel(el);
        scheduleCollapse(el);
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

  /** 中間成果自動收折的計時器；重繪時清除以免收折到新畫面。 */
  let collapseTimer = null;
  /** 等待回答頁：先展開頭腦風暴成果讓使用者看脈絡，partialCollapseMs 後自動收折，問題浮到視野內。 */
  function scheduleCollapse(el) {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      el.querySelectorAll('.partials details[open]').forEach((d) => { d.open = false; });
    }, partialCollapseMs);
  }

  /** 進行中／等待回答頁的「放棄此案」按鈕：停止輪詢並回輸入頁。 */
  function bindCancel(el) {
    el.querySelector('#cancel-case')?.addEventListener('click', reset);
  }

  /** 失敗頁：錯誤代碼、步驤、訊息與重試。 */
  function renderFailed(error, loc) {
    return `<section class="failed card" role="alert"><h2>${ICONS.alert}${esc(t('failed.title', loc))}</h2>
      <p class="code">${esc(error?.code || '')} @ ${esc(error?.step || '')}</p><p>${esc(error?.message || '')}</p>
      <div class="actions"><button id="retry" type="button" class="primary">${ICONS.refresh}${esc(t('failed.retry', loc))}</button></div></section>`;
  }

  /** 開始（或重新開始）輪詢指定案件。 */
  function beginPolling(caseId) {
    if (stopPolling) stopPolling();
    stopPolling = client.poll(caseId, (s) => dispatch({ type: 'STATUS', status: s }));
  }

  /** 啟動新案件；回傳 CaseStatus（空白文字回 null）。 */
  async function start(text) {
    if (!text || !text.trim()) return null;

    // WebMCP 呼叫可能因網路或 Agent host 延遲；先切換進度頁，讓使用者立即看到案件已進入啟動流程。
    const requestId = ++startRequestId;
    dispatch({ type: 'START', caseId: null });

    let s;
    try {
      s = await client.start(text.trim(), locale);
    } catch (error) {
      // 已取消或已被另一個請求取代時，不讓過期錯誤覆蓋目前畫面。
      if (requestId === startRequestId) {
        dispatch({
          type: 'STATUS',
          status: {
            status: 'FAILED',
            step: 'BRAINSTORM',
            locale,
            error: { code: error.code || 'START_FAILED', message: error.message || 'Unable to start case.' }
          }
        });
      }
      throw error;
    }

    // 使用者在 POST 完成前按下取消時，忽略這個已失效的案件回應。
    if (requestId !== startRequestId) return null;
    storage.setItem('caseId', s.caseId);
    dispatch({ type: 'START', caseId: s.caseId });
    beginPolling(s.caseId);
    return s;
  }

  /** 以示範案例 id 啟動；找不到回 null。 */
  async function startSample(id) {
    // Agent 通常會使用 listSampleCases 的 id；也接受畫面上的標題，降低自然語言呼叫的脆弱性。
    const value = String(id || '').trim();
    let smp = samples.find((x) => x.id === value || x.title === value);
    // WebMCP 工具可能在首次 mount 的載入競速中被呼叫，這裡再補一次資料載入作為安全網。
    if (!smp && value) {
      const loaded = await client.samples(locale).catch(() => []);
      if (loaded.length) samples = loaded;
      smp = samples.find((x) => x.id === value || x.title === value);
    }
    return smp ? start(smp.text) : null;
  }

  /** 送出回答並續接輪詢。 */
  async function answer(answers) {
    const s = await client.answer(state.caseId, answers);
    dispatch({ type: 'STATUS', status: s });
    beginPolling(state.caseId);
    return s;
  }

  /** 取得目前問題表單的值，避免 AI 填入時覆蓋人已經輸入但尚未送出的答案。 */
  function captureQuestionDraft() {
    root.querySelectorAll('#questions-form textarea').forEach((textarea) => {
      questionDraft[textarea.name] = textarea.value;
    });
  }

  /** 將工具參數正規化為 [{ questionId, answer }]，兼容 Agent 傳入 JSON 字串或 id 對照物件。 */
  function normalizeAnswerItems(answers) {
    let value = answers;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return null; }
    }
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray(value.answers)) return value.answers;
    if (value && typeof value === 'object') {
      return Object.entries(value).map(([questionId, answer]) => ({ questionId, answer }));
    }
    return null;
  }

  /** 將 Agent 提供的答案填入可見問題欄位；只有確實套用到 DOM 才回報成功，且不送出後端。 */
  function fillQuestions(answers) {
    if (state.view !== States.QUESTIONS) {
      return { ok: false, error: 'QUESTIONS_NOT_VISIBLE', message: 'Question fields are not visible on the page.' };
    }
    const items = normalizeAnswerItems(answers);
    if (!items) {
      return { ok: false, error: 'INVALID_ANSWERS', message: 'answers must be an array of { questionId, answer }.' };
    }

    captureQuestionDraft();
    const questions = state.last?.questions || [];
    const validIds = new Set(questions.map((question) => question.id));
    const seen = new Set();
    const invalidQuestionIds = [];
    const emptyAnswerQuestionIds = [];
    const proposed = [];
    for (const item of items) {
      const id = String(item?.questionId || '').trim();
      if (!id || !validIds.has(id) || seen.has(id)) {
        if (id) invalidQuestionIds.push(id);
        continue;
      }
      seen.add(id);
      const answer = String(item?.answer ?? '');
      if (!answer.trim()) {
        emptyAnswerQuestionIds.push(id);
        continue;
      }
      proposed.push({ id, answer });
    }

    if (!proposed.length) {
      return {
        ok: false,
        submitted: false,
        error: 'NO_ANSWERS_APPLIED',
        ...getQuestionProgress(),
        invalidQuestionIds,
        emptyAnswerQuestionIds,
        message: 'No answer was applied. Use questionId from getQuestions and provide non-empty answer text.'
      };
    }

    proposed.forEach(({ id, answer }) => { questionDraft[id] = answer; });
    render();
    const appliedQuestionIds = proposed
      .filter(({ id, answer }) => root.querySelector(`#questions-form textarea[name="${CSS.escape(id)}"]`)?.value === answer)
      .map(({ id }) => id);
    const failedQuestionIds = proposed.map(({ id }) => id).filter((id) => !appliedQuestionIds.includes(id));
    if (!appliedQuestionIds.length) {
      return {
        ok: false,
        submitted: false,
        error: 'NO_ANSWERS_APPLIED',
        ...getQuestionProgress(),
        invalidQuestionIds,
        emptyAnswerQuestionIds,
        failedQuestionIds,
        message: 'The answer was not found in the visible question fields; the page was not updated.'
      };
    }

    questionFillNotice = locale === 'zh-TW'
      ? `Agent 已實際填入 ${appliedQuestionIds.length} 題，請逐題檢查後再按「繼續」。`
      : `Agent filled ${appliedQuestionIds.length} visible question field(s). Review them before clicking Continue.`;
    render();
    return {
      ok: failedQuestionIds.length === 0,
      submitted: false,
      humanReviewRequired: true,
      ...getQuestionProgress(),
      appliedQuestionIds,
      invalidQuestionIds,
      emptyAnswerQuestionIds,
      failedQuestionIds,
      message: failedQuestionIds.length
        ? 'Some answers were filled into the visible form. The human must review them and submit the form.'
        : 'Answers were filled into the visible form. The human must review them and submit the form.'
    };
  }

  /** 回傳問題填寫進度但不暴露答案內容，供 WebMCP 狀態查詢使用。 */
  function getQuestionProgress() {
    const questions = state.last?.questions || [];
    const missingQuestionIds = questions
      .filter((question) => !String(questionDraft[question.id] || '').trim())
      .map((question) => question.id);
    return {
      filledQuestionCount: questions.length - missingQuestionIds.length,
      questionCount: questions.length,
      missingQuestionIds
    };
  }

  /** 捨棄目前案件，回到輸入頁。 */
  function reset() {
    startRequestId++;
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
    setLocale, start, startSample, answer, fillQuestions, getQuestionProgress, reset,
    verify: (ref) => client.verify(ref),
    onChange: (l) => listeners.add(l)
  };
}
