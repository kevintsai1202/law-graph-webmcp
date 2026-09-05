import { t, detectLocale, DICT } from './i18n.js';
import { States, reduce, initialState } from './state.js';
import { esc, mount as mountHtml } from './views/util.js';
import { ICONS } from './views/icons.js';
import { renderInput, bindInput, MIN_CHARS, LAW_POWERS_URL } from './views/input.js';
import { renderProgress, renderCancel } from './views/progress.js';
import { renderQuestions, bindQuestions } from './views/questions.js';
import { renderResult, bindResult, renderSections, tabsFor, tabLabel, checklistCsv, findingsCsv } from './views/result.js';
import { renderHome, bindHome } from './views/home.js';
import { renderStats } from './views/stats.js';
import { parseHash, hashFor } from './router.js';
import { normalizeOutputs, OUTPUT_OPTIONS, outputOptionsFor } from './documents.js';

/** 語意檢索回報需要授權時，產生保留目前頁面的 OAuth 啟動路徑。 */
export function semanticAuthPath(status, locationLike = globalThis.location) {
  if (!status?.result?.research?.coverage?.authorizationRequired) return null;
  const search = locationLike?.search || '';
  if (new URLSearchParams(search).has('mcpAuth')) return null;
  const returnTo = `${locationLike?.pathname || '/'}${search}`;
  return `/api/auth/tw-legal-rag/start?returnTo=${encodeURIComponent(returnTo)}`;
}

/** 以 Blob 觸發瀏覽器下載；測試環境無 document 或 createObjectURL 時安全略過。 */
function downloadText(text, filename, mime) {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

/** 應用程式核心：持有狀態、驅動輪詢、切換 view；WebMCP 由 webmcp.js 透過 onChange 掛上。 */
export function createApp({ root, client, storage, navigatorLanguage, partialCollapseMs = 5000, locationLike = globalThis.location }) {
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
  /** 使用者是否在本案件中主動點過結果分頁；未點過時合約模式一律回到 findings（規格 §4.5 分頁順序）。 */
  let tabChosenByUser = false;
  /** 合約模式風險清單的風險等級篩選（all／high／medium／low）。 */
  let riskFilter = 'all';
  /** 目前能力模式；尚未選擇時視為案件分析。 */
  const mode = () => state.mode || 'case';
  /** hashchange 只在 mount 時註冊一次。 */
  let hashListenerBound = false;
  /** 此案件選擇的輸出；需跨輪詢與重新整理保留，才能呈現正確結果分頁。 */
  let selectedOutputs = ['graph'];
  /** QUESTIONS 頁的答案草稿；AI 填入後仍由人檢查並送出。 */
  let questionDraft = {};
  /** 最近一次 Agent 實際填入欄位的提示；避免只回報模擬成功但畫面沒有證據。 */
  let questionFillNotice = null;
  /** 語意檢索 MCP 授權狀態（null、未啟用、或已啟用未授權／已授權）。 */
  let semanticAuth = null;
  /** 今日 token 用量快照（/api/usage）；null 代表尚未取得。 */
  let usage = null;
  /** 呼叫端今日案件配額（/api/quota）；null 代表尚未取得或後端不限制。 */
  let quota = null;
  /** 統計頁資料（/api/stats）；null 代表載入中，{ error } 代表載入失敗。 */
  let stats = null;
  /** OAuth callback query 已被消耗時，不再自動導向，避免授權失敗造成重導迴圈。 */
  const hadAuthCallback = consumeAuthCallbackQuery();
  /** 同一頁面生命週期只允許自動導向授權一次。 */
  let authRedirected = hadAuthCallback;

  /** 向後端查詢語意 MCP 的授權狀態，並一併更新今日 token 用量。 */
  async function refreshAuthStatus() {
    const usageReady = refreshUsage();
    if (typeof client?.authStatus === 'function') {
      try {
        semanticAuth = await client.authStatus();
      } catch {
        semanticAuth = null;
      }
    }
    await usageReady;
    return semanticAuth;
  }

  /** 向後端查詢今日 token 用量與本人案件配額；失敗時視為未知、不阻擋畫面。 */
  async function refreshUsage() {
    [usage, quota] = await Promise.all([
      Promise.resolve().then(() => client?.usage?.()).catch(() => null),
      Promise.resolve().then(() => client?.quota?.()).catch(() => null)
    ]);
    return usage;
  }
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
    const authPath = semanticAuthPath(nextState.last);
    if (!authRedirected && authPath && typeof globalThis.location?.assign === 'function') {
      authRedirected = true;
      globalThis.location.assign(authPath);
    }
    // 同步網址 hash：讓上一頁／分享網址能回到同一條流程（首頁為 #/）
    const nextHash = hashFor(state);
    if (locationLike && (locationLike.hash || '#/') !== nextHash) locationLike.hash = nextHash;
    render();
    listeners.forEach((l) => l(state, 'STATE'));
  }

  /** 依 view 渲染並綁事件；[data-i18n] 節點同步換字。 */
  function render() {
    const el = stage(); if (!el) return;
    clearTimeout(collapseTimer);
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n, locale); });
    // [data-i18n-aria] 節點同步換 aria-label（節點假物件可能沒有 setAttribute，需防呆）
    root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute?.('aria-label', t(n.dataset.i18nAria, locale)); });
    switch (state.view) {
      case States.HOME:
        mountHtml(el, renderHome(locale, { quota }));
        bindHome(el, { onSelect: selectMode });
        break;
      case States.INPUT: {
        // 重繪輸入頁前先保住使用者已輸入的案情：mount 載完示範案例／配額後會再 render 一次，
        // 若使用者已開始打字，不能把文字洗掉（2026-09-05 e2e 實測會清空）。
        const typed = el.querySelector?.('#case-text')?.value ?? '';
        mountHtml(el, renderInput({ samples, semanticAuth, usage, quota, mode: mode() }, locale));
        bindInput(el, { onSubmit: start, onSample: startSample }, locale, mode());
        if (typed) {
          const ta = el.querySelector('#case-text');
          if (ta) { ta.value = typed; ta.dispatchEvent?.(new globalThis.Event('input', { bubbles: true })); }
        }
        break;
      }
      case States.RUNNING:
        // 放棄按鈕緊接進度列，捲動前就看得到
        mountHtml(el, renderProgress({ step: state.last?.step || firstStep(), mode: mode() }, locale) + renderCancel(locale)
          + renderSections(state.last?.result, locale, mode()));
        bindCancel(el);
        break;
      case States.QUESTIONS:
        // 頭腦風暴成果放在提問之前（先看脈絡再回答），數秒後自動收折讓問題浮上來
        mountHtml(el, renderProgress({ step: 'QUESTIONS', busy: false, mode: mode() }, locale) + renderCancel(locale) + renderSections(state.last.result, locale, mode())
          + renderQuestions({ questions: state.last.questions, answers: questionDraft, notice: questionFillNotice }, locale));
        bindQuestions(el, { onSubmit: answer });
        bindCancel(el);
        scheduleCollapse(el);
        break;
      case States.RESULT:
        // 合約模式預設分頁為 findings：不論 RESULT 由何種路徑進入（含直接派送 STATUS COMPLETED），
        // 只要使用者本案件尚未主動點過分頁，就把模組預設的 graph 改回 findings。
        if (mode() === 'contract' && !tabChosenByUser && activeTab === 'graph') activeTab = 'findings';
        mountHtml(el, renderResult({ status: state.last, activeTab, outputs: selectedOutputs, mode: mode(), riskFilter }, locale));
        bindResult(el, { onTab: (k) => { tabChosenByUser = true; activeTab = k; render(); }, onNewCase: reset });
        // 合約模式風險清單：風險等級篩選與 CSV 匯出
        el.querySelector('#findings-filter')?.querySelectorAll?.('button[data-risk]')?.forEach?.((b) => {
          b.addEventListener('click', () => { riskFilter = b.dataset.risk || 'all'; render(); });
        });
        el.querySelector('#findings-export')?.addEventListener('click', () => {
          // 依目前風險篩選匯出：使用者看到什麼就匯出什麼
          const all = state.last?.result?.compliance?.findings || state.last?.result?.findings?.findings || [];
          const findings = riskFilter === 'all' ? all : all.filter((f) => f.risk === riskFilter);
          downloadText(findingsCsv(findings, locale), t('finding.file', locale), 'text/csv;charset=utf-8');
        });
        // 當事人準備清單：CSV 下載與列印
        el.querySelector('#checklist-export')?.addEventListener('click', () => {
          const items = state.last?.result?.assessment?.checklist || [];
          downloadText(checklistCsv(items, locale), t('checklist.file', locale), 'text/csv;charset=utf-8');
        });
        el.querySelector('#checklist-print')?.addEventListener('click', () => {
          // 僅列印清單本體：加上 printing-checklist class 限縮 @media print 範圍，
          // 列印結束（afterprint）或逾時後移除，避免影響一般 Ctrl+P 列印其他頁籤
          const body = globalThis.document?.body;
          body?.classList.add('printing-checklist');
          const cleanup = () => body?.classList.remove('printing-checklist');
          try {
            globalThis.addEventListener?.('afterprint', cleanup, { once: true });
            globalThis.print?.();
          } finally {
            globalThis.setTimeout?.(cleanup, 2000);
          }
        });
        listeners.forEach((l) => l(state, 'RESULT_RENDERED'));
        break;
      case States.STATS:
        mountHtml(el, renderStats(stats, locale));
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

  /** 目前模式流程的第一個步驟代碼（合約審查為 LOAD，案件分析為 BRAINSTORM）。 */
  function firstStep() {
    return mode() === 'contract' ? 'LOAD' : 'BRAINSTORM';
  }

  /** 首頁選能力：記下 mode、載入該模式的示範案例，並進入輸入頁。 */
  async function selectMode(next) {
    dispatch({ type: 'SELECT_MODE', mode: next });
    samples = await Promise.resolve().then(() => client.samples(locale, mode())).catch(() => []);
    render();
  }

  /** 進入統計頁：先顯示載入中，再取近 30 日資料；失敗時顯示錯誤而不影響進行中的案件。 */
  async function showStats() {
    dispatch({ type: 'SHOW_STATS' });
    stats = null;
    render();
    try {
      stats = await client.stats(30);
    } catch (e) {
      stats = { error: e?.message || 'ERROR' };
    }
    render();
  }

  /** 回首頁（不清除案件記錄；要捨棄案件請用 reset）。 */
  function goHome() {
    dispatch({ type: 'GO_HOME' });
  }

  /** 進行中／等待回答頁的「放棄此案」按鈕：停止輪詢並回輸入頁。 */
  function bindCancel(el) {
    el.querySelector('#cancel-case')?.addEventListener('click', reset);
  }

  /** 失敗頁：錯誤代碼、步驤、訊息與重試；額度用完時附上 Law Powers 替代方案。 */
  function renderFailed(error, loc) {
    return `<section class="failed card" role="alert"><h2>${ICONS.alert}${esc(t('failed.title', loc))}</h2>
      <p class="code">${esc(error?.code || '')} @ ${esc(error?.step || '')}</p><p>${esc(error?.message || '')}</p>
      ${error?.code === 'DAILY_TOKEN_LIMIT' ? `<p class="alt">${esc(t('usage.exhausted.tip', loc))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t('usage.exhausted.action', loc))} ↗</a></p>` : ''}
      ${error?.code === 'DAILY_CASE_LIMIT' ? `<p class="alt">${esc(t('quota.reason', loc))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t('usage.exhausted.action', loc))} ↗</a></p>` : ''}
      <div class="actions"><button id="retry" type="button" class="primary">${ICONS.refresh}${esc(t('failed.retry', loc))}</button></div></section>`;
  }

  /** 開始（或重新開始）輪詢指定案件。 */
  function beginPolling(caseId, { resumed = false } = {}) {
    if (stopPolling) stopPolling();
    stopPolling = client.poll(caseId, (s) => {
      // 續接（F5／重開頁面）時若案件已不存在（服務重啟後記憶體案件清空），直接清除記錄回到輸入頁，不當成分析失敗。
      if (resumed && s?.status === 'FAILED' && s?.error?.code === 'CASE_NOT_FOUND') {
        storage.removeItem('caseId');
        storage.removeItem('outputs');
        dispatch({ type: 'RESET' });
        return;
      }
      dispatch({ type: 'STATUS', status: s });
    });
  }

  /** 啟動新案件；回傳 CaseStatus（空白文字回 null）。 */
  async function start(text, outputs, files = [], motionRequest = '', extra = {}) {
    if ((!text || !text.trim()) && (!Array.isArray(files) || !files.length)) return null;

    /** 本次送出的模式；dispatch START 之後 state.mode 才會固定，先取一份避免競態。 */
    const m = mode();
    selectedOutputs = normalizeOutputs(outputs, m);
    tabChosenByUser = false;
    activeTab = m === 'contract' ? 'findings'
      : selectedOutputs.includes('graph') ? 'graph' : 'doc-' + selectedOutputs[0];

    // WebMCP 呼叫可能因網路或 Agent host 延遲；先切換進度頁，讓使用者立即看到案件已進入啟動流程。
    const requestId = ++startRequestId;
    dispatch({ type: 'START', caseId: null, mode: m });

    // 合約模式才附上 mode／party／scopes；案件模式維持既有五參數契約
    const payloadExtra = m === 'contract'
      ? [{ mode: 'contract', party: extra?.party || 'unknown', scopes: extra?.scopes || [] }]
      : [];
    // 合約模式的 documents 就是勾選的輸出（可為空）；案件模式的關聯圖不是書狀，要濾掉
    const documents = m === 'contract' ? selectedOutputs : selectedOutputs.filter((o) => o !== 'graph');

    let s;
    try {
      s = await client.start((text || '').trim(), locale, documents, files, motionRequest, ...payloadExtra);
      refreshUsage().catch(() => {});
    } catch (error) {
      // 已取消或已被另一個請求取代時，不讓過期錯誤覆蓋目前畫面。
      if (requestId === startRequestId) {
        dispatch({
          type: 'STATUS',
          status: {
            status: 'FAILED',
            step: m === 'contract' ? 'LOAD' : 'BRAINSTORM',
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
    storage.setItem('outputs', JSON.stringify(selectedOutputs));
    storage.setItem('mode', m);
    dispatch({ type: 'START', caseId: s.caseId, mode: m });
    beginPolling(s.caseId);
    return s;
  }

  /** 以示範案例 id 啟動；找不到回 null。 */
  async function startSample(id, outputs, extra = {}) {
    // Agent 通常會使用 listSampleCases 的 id；也接受畫面上的標題，降低自然語言呼叫的脆弱性。
    const value = String(id || '').trim();
    let smp = samples.find((x) => x.id === value || x.title === value);
    // WebMCP 工具可能在首次 mount 的載入競速中被呼叫，這裡再補一次資料載入作為安全網。
    if (!smp && value) {
      const loaded = await client.samples(locale, mode()).catch(() => []);
      if (loaded.length) samples = loaded;
      smp = samples.find((x) => x.id === value || x.title === value);
    }
    return smp ? start(smp.text, outputs, [], '', extra) : null;
  }

  /** 送出回答並續接輪詢。 */
  /** 送出人工回答並續接輪詢；失敗（例如服務重啟後案件已不存在）要顯示失敗頁，不能按了沒反應。 */
  async function answer(answers) {
    let s;
    try {
      s = await client.answer(state.caseId, answers);
    } catch (error) {
      dispatch({ type: 'STATUS', status: {
        status: 'FAILED', step: 'QUESTIONS', locale,
        error: { code: error.code || 'ANSWER_FAILED', message: error.message || 'Unable to submit answers.' }
      } });
      throw error;
    }
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

  /** 將 WebMCP 指定的輸出套用到可見勾選框；只更新表單，不會直接送出案件。 */
  function setOutputs(outputs) {
    if (state.view !== States.INPUT) {
      return { ok: false, error: 'INPUT_NOT_VISIBLE', message: 'Output checkboxes are only visible on the input page.' };
    }
    const requested = Array.isArray(outputs) ? outputs : [];
    // 有效選項隨模式而異（合約模式只有 revised）；合約模式允許不勾任何輸出，故只擋「含無效值且無任何有效值」
    const valid = outputOptionsFor(mode());
    if (!requested.some((output) => valid.includes(output))) {
      return { ok: false, error: 'INVALID_OUTPUTS', validOutputs: [...valid], message: 'outputs must contain at least one valid option.' };
    }
    const applied = normalizeOutputs(requested, mode());
    const boxes = [...root.querySelectorAll('input[name="outputs"]')];
    if (!boxes.length) {
      return { ok: false, error: 'INPUT_NOT_VISIBLE', message: 'Output checkboxes are not rendered yet.' };
    }
    boxes.forEach((box) => { box.checked = applied.includes(box.value); });
    boxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    return {
      ok: true,
      submitted: false,
      humanReviewRequired: true,
      applied,
      message: 'Outputs ticked on the visible form. The human must review and click Analyse, or call startCase with documents to start directly.'
    };
  }

  /** 取得單一輸出代碼在目前語系的顯示名稱。 */
  function outputLabel(code) {
    return code === 'graph' ? t('output.graph', locale) : t('doc.' + code, locale);
  }

  /** 回傳輸出選項及勾選狀態，供 WebMCP 讀取可見表單。 */
  function getOutputOptions() {
    const boxes = state.view === States.INPUT ? [...root.querySelectorAll('input[name="outputs"]')] : [];
    const checkedSet = new Set(boxes.length ? boxes.filter((box) => box.checked).map((box) => box.value) : selectedOutputs);
    // 合約模式的選項清單只有修訂本，且不預設勾選、也不強制至少勾一項
    const contract = mode() === 'contract';
    const options = outputOptionsFor(mode()).map((code) => ({
      code,
      label: outputLabel(code),
      kind: code === 'graph' ? 'graph' : 'document',
      checked: checkedSet.has(code),
      isDefault: !contract && code === 'graph'
    }));
    return {
      ok: true,
      view: state.view,
      rendered: boxes.length > 0,
      count: options.length,
      checkedCount: options.filter((option) => option.checked).length,
      minRequired: contract ? 0 : 1,
      mode: mode(),
      options,
      nextAction: state.view === States.INPUT
        ? 'Use setOutputSelection to tick outputs, or pass documents to startCase.'
        : 'Output checkboxes are only editable on the input page.'
    };
  }

  /** 回傳輸入頁可見內容摘要；案情文字設長度上限，避免 WebMCP 回傳過大。 */
  function getInputForm() {
    if (state.view !== States.INPUT) {
      return { ok: false, error: 'INPUT_NOT_VISIBLE', view: state.view, message: 'The input form is only visible on the input page.' };
    }
    const fullText = root.querySelector('#case-text')?.value ?? '';
    const CASE_TEXT_PREVIEW = 800;
    const submit = root.querySelector('#case-submit');
    return {
      ok: true,
      view: state.view,
      locale,
      caseText: fullText.slice(0, CASE_TEXT_PREVIEW),
      caseTextTruncated: fullText.length > CASE_TEXT_PREVIEW,
      charCount: fullText.trim().length,
      minChars: MIN_CHARS,
      canSubmit: Boolean(submit) && !submit.disabled,
      mode: mode(),
      // 合約模式專屬欄位：我方立場與審查範疇的目前勾選狀態
      contract: mode() === 'contract' ? {
        party: root.querySelector('input[name="party"]:checked')?.value || 'unknown',
        scopes: [...root.querySelectorAll('input[name="scopes"]:checked')].map((c) => c.value)
      } : undefined,
      outputs: getOutputOptions(),
      sampleCount: samples.length,
      samples: samples.map(({ id, title }) => ({ id, title }))
    };
  }

  /** 回傳完成頁分頁、目前分頁及對應成果是否實際存在。 */
  function getResultTabs() {
    if (state.view !== States.RESULT) {
      return { ok: false, error: 'RESULT_NOT_VISIBLE', view: state.view, message: 'Result tabs are only visible after the case is completed.' };
    }
    const result = state.last?.result || {};
    const tabs = tabsFor(selectedOutputs, !!result.assessment?.checklist?.length, mode(), result).map((id) => {
      const available = id === 'graph'
        ? Boolean(result.graph)
        : id === 'findings'
          ? Boolean(result.compliance?.findings?.length)
          : id === 'summary'
            ? Boolean(result.compliance)
            : id === 'laws'
              ? Boolean(result.research)
              : id.startsWith('doc-')
                ? (result.documents || []).some((document) => document.type === id.slice(4))
                : Boolean(result[id]);
      return { id, label: tabLabel(id, locale), active: id === activeTab, available };
    });
    return {
      ok: true,
      view: state.view,
      generatedLocale: state.last?.locale || locale,
      mode: mode(),
      outputs: [...selectedOutputs],
      count: tabs.length,
      activeTab,
      tabs,
      nextAction: 'Use getAnalysis with section brainstorm/research/analysis/documents, or getGraphSummary for the graph.'
    };
  }

  /** 捨棄目前案件，回到輸入頁。 */
  async function reset() {
    startRequestId++;
    if (stopPolling) stopPolling();
    stopPolling = null;
    storage.removeItem('caseId');
    storage.removeItem('outputs');
    storage.removeItem('mode');
    activeTab = 'graph';
    tabChosenByUser = false;
    selectedOutputs = ['graph'];
    riskFilter = 'all';
    authRedirected = false;
    await refreshAuthStatus();
    dispatch({ type: 'RESET' });
  }

  /** 切換語系：存起來、重載示範案例、重繪。 */
  async function setLocale(code) {
    locale = code in DICT ? code : 'en';
    storage.setItem('locale', locale);
    samples = await client.samples(locale, mode());
    const sel = root.querySelector('#lang-select'); if (sel) sel.value = locale;
    listeners.forEach((l) => l(state, 'LOCALE'));
    render();
  }

  /** 掛載：語系選單、載示範案例、續接進行中的 case。 */
  async function mount() {
    // 語系選單已自頁首移除（語系改由瀏覽器語言決定）；保留相容：若頁面仍有選單就綁定。
    const sel = root.querySelector('#lang-select');
    if (sel) { sel.value = locale; sel.addEventListener('change', () => setLocale(sel.value)); }
    // 初次載入依網址 hash 決定要進哪一條流程；未指定時停在首頁
    const initial = parseHash(locationLike?.hash);
    bindHashChange();
    const saved = storage.getItem('caseId');
    // 續接時示範案例要載入儲存的模式（放棄案件回輸入頁才不會拿到另一條流程的範例）
    const savedMode = saved ? (storage.getItem('mode') || 'case') : null;
    const [, loadedSamples] = await Promise.all([
      refreshAuthStatus(),
      Promise.resolve().then(() => client.samples(locale, savedMode || initial.mode || 'case')).catch(() => [])
    ]);
    samples = loadedSamples;
    if (saved) {
      // 續接進行中的案件：模式與輸出選擇都要沿用上次送出的值，結果分頁才會正確
      try {
        selectedOutputs = normalizeOutputs(JSON.parse(storage.getItem('outputs')), savedMode);
      } catch {
        selectedOutputs = normalizeOutputs([], savedMode);
      }
      tabChosenByUser = false;
      activeTab = savedMode === 'contract' ? 'findings'
        : selectedOutputs.includes('graph') ? 'graph' : 'doc-' + selectedOutputs[0];
      dispatch({ type: 'START', caseId: saved, mode: savedMode });
      beginPolling(saved, { resumed: true });
    } else if (initial.view === 'STATS') {
      await showStats();
    } else if (initial.view === 'INPUT') {
      await selectMode(initial.mode);
    } else render();
  }

  /** 監聽瀏覽器上一頁／下一頁的 hash 變動，在首頁與輸入頁之間同步切換。 */
  function bindHashChange() {
    if (hashListenerBound) return;
    hashListenerBound = true;
    // 回傳監聽器內的 Promise（reset 為非同步），讓測試可以 await 這次 hash 變更的處理結果
    globalThis.addEventListener?.('hashchange', () => {
      const parsed = parseHash(locationLike?.hash);
      if (parsed.view === 'STATS') return showStats();
      // 離開統計頁：有案件記錄就回到該案件畫面（看統計不該捨棄案件），否則依目的地進輸入頁或首頁
      if (state.view === States.STATS) {
        if (state.caseId && state.last) { dispatch({ type: 'STATUS', status: state.last, leaveStats: true }); return undefined; }
        if (parsed.view === 'INPUT') return selectMode(parsed.mode);
        goHome();
        return undefined;
      }
      if (state.view === States.HOME && parsed.view === 'INPUT') return selectMode(parsed.mode);
      if (parsed.view === 'HOME' && state.view !== States.HOME) return leaveToHome();
      // 直接在兩條輸入頁之間切換 hash（例如 #/contract → #/case），也要重新載入該模式的示範案例
      if (state.view === States.INPUT && parsed.view === 'INPUT' && parsed.mode !== mode()) return selectMode(parsed.mode);
      return undefined;
    });
  }

  /**
   * 品牌連結／上一頁把 hash 改回 #/ 時離開目前流程回首頁。
   * 輸入頁直接回首頁；已完成或已失敗的案件可安全捨棄；進行中或等待回答則先向使用者確認，
   * 取消時要把 hash 寫回目前流程，否則網址與畫面會不一致。
   */
  function leaveToHome() {
    if (state.view === States.INPUT) { goHome(); return Promise.resolve(); }
    if (state.view === States.RUNNING || state.view === States.QUESTIONS) {
      if (stopPolling) { stopPolling(); stopPolling = null; }
      if (globalThis.confirm?.(t('home.leaveConfirm', locale)) === false) {
        if (locationLike) locationLike.hash = hashFor(state);
        // 使用者選擇留下：重新續接輪詢，不讓案件停在半途
        if (state.caseId) beginPolling(state.caseId, { resumed: true });
        return Promise.resolve();
      }
    }
    return reset();
  }

  return {
    mount, dispatch, getState: () => state, getLocale: () => locale, getSamples: () => samples,
    getAuthStatus: () => semanticAuth, refreshAuthStatus, getUsage: () => usage, refreshUsage,
    /** 呼叫端今日配額（含 loggedIn／memberLimit）與 REST client，供右上角登入區使用。 */
    getQuota: () => quota, client,
    setLocale, selectMode, goHome, showStats, getStats: (days = 30) => client.stats(days), getMode: mode, setRiskFilter: (r) => { riskFilter = r; render(); },
    start, startSample, answer, fillQuestions, getQuestionProgress,
    setOutputs, getOutputOptions, getInputForm, getResultTabs, reset,
    verify: (ref) => client.verify(ref),
    onChange: (l) => listeners.add(l)
  };
}

/** 消耗 OAuth callback 標記並清理網址，避免重新整理後重複處理授權結果。 */
function consumeAuthCallbackQuery() {
  const location = globalThis.location;
  const params = new URLSearchParams(location?.search || '');
  if (!params.has('mcpAuth')) return false;
  params.delete('mcpAuth');
  if (typeof globalThis.history?.replaceState === 'function') {
    const query = params.toString();
    const path = (location?.pathname || '/') + (query ? '?' + query : '') + (location?.hash || '');
    globalThis.history.replaceState(null, '', path);
  }
  return true;
}
