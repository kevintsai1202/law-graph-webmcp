/** WebMCP 工具層：依頁面狀態註冊可用工具；沒有代答工具。 */
import { DOC_TYPES } from './documents.js';
import { CONTRACT_SCOPES } from './contract.js';

/** 產生 object 型 inputSchema（一律 additionalProperties:false）。 */
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
/** 共用的語系參數。 */
const LOCALE = { type: 'string', enum: ['en', 'zh-TW'], description: 'Output language' };

/** 二十二個工具的穩定契約（不含 execute，可在 node 驗證）。phase 保留供文件與相容性使用。 */
export const TOOL_DEFS = [
  { name: 'listSampleCases', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List the built-in fictional sample disputes that can be analysed with startCase.',
    inputSchema: S({ locale: LOCALE }) },
  { name: 'startCase', phase: 'base', annotations: {},
    description: 'Start one Taiwan legal dispute from caseText or a sampleId. Only use when the page is in INPUT; never replace an active case.',
    inputSchema: S({ caseText: { type: 'string', minLength: 20 }, sampleId: { type: 'string', description: 'Exact id or title returned by listSampleCases, e.g. car-accident.' }, motionRequest: { type: 'string', description: 'Only with documents containing motion: what the court is asked to grant, e.g. 聲請調查證據.' }, locale: LOCALE,
      documents: { type: 'array', description: 'Litigation documents to draft besides the graph, e.g. complaint (起訴狀), defense (答辯狀).', items: { type: 'string', enum: [...DOC_TYPES] } } }) },
  { name: 'setOutputSelection', phase: 'base', annotations: {},
    description: 'Tick the "outputs to generate" checkboxes on the input form (graph and Taiwan pleading types). Does not start the case.',
    inputSchema: S({ outputs: { type: 'array', minItems: 1, description: 'Outputs to tick; unlisted ones are unticked.', items: { type: 'string', enum: ['graph', ...DOC_TYPES] } } }, ['outputs']) },
  { name: 'getOutputOptions', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List the "outputs to generate" checkboxes shown on the input form: count, code, label, and which are ticked.',
    inputSchema: S({}) },
  { name: 'getInputForm', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Read everything shown on the input page: typed case text, character count, minimum, submit state, output checkboxes and sample count.',
    inputSchema: S({}) },
  { name: 'getResultTabs', phase: 'completed', annotations: { readOnlyHint: true },
    description: 'List the tabs shown on the result page (graph, drafted documents, analysis, research, brainstorm), which is active and which have content.',
    inputSchema: S({}) },
  { name: 'getCaseStatus', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Read the current page case state. WAITING means the human must answer visible questions; call getQuestions before filling.',
    inputSchema: S({}) },
  { name: 'getQuestions', phase: 'questions', annotations: { readOnlyHint: true },
    description: 'List each visible question with its questionId and the exact fillQuestions answer format. Call before filling.',
    inputSchema: S({}) },
  { name: 'fillQuestions', phase: 'questions', annotations: {},
    description: 'Fill proposed answers into visible fields using questionId from getQuestions. Does not submit; a human must review and click Continue.',
    inputSchema: S({ answers: { type: 'array', description: 'One item per visible question; use questionId returned by getQuestions.', items: S({ questionId: { type: 'string', description: 'The exact questionId returned by getQuestions, such as q1.' }, answer: { type: 'string', description: 'Proposed answer text for that question.' } }, ['questionId', 'answer']) } }, ['answers']) },
  { name: 'verifyCitation', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Check whether a Taiwan statute article or judgment citation exists in official databases.',
    inputSchema: S({ ref: { type: 'string', description: 'e.g. 民法第184條 or 最高法院108年度台上字第2345號' } }, ['ref']) },
  { name: 'resetCase', phase: 'base', annotations: {},
    description: 'Discard the current case and return to input. Use only after the human explicitly asks to abandon it; never replace a WAITING case automatically.',
    inputSchema: S({}) },
  { name: 'getAnalysis', phase: 'completed', annotations: { readOnlyHint: true, untrustedContentHint: true },
    description: 'Return one section of the completed analysis: brainstorm, research or analysis. Long output is summarised.',
    inputSchema: S({ section: { type: 'string', enum: ['brainstorm', 'research', 'analysis', 'documents'] } }, ['section']) },
  { name: 'getGraphSummary', phase: 'completed', annotations: { readOnlyHint: true },
    description: 'Counts by node group, edge count, main issues and elements not yet satisfied.',
    inputSchema: S({}) },
  { name: 'focusNode', phase: 'completed', annotations: {},
    description: 'Fly the 3D camera to a node (by id or label text), open its detail panel and return its neighbours.',
    inputSchema: S({ nodeId: { type: 'string' }, label: { type: 'string' } }) },
  { name: 'filterGraph', phase: 'completed', annotations: {},
    description: 'Show only some node groups (fact, law, judgment, issue, element, ...) or one case family; reset restores all.',
    inputSchema: S({ groups: { type: 'array', items: { type: 'string' } }, family: { type: 'string' }, reset: { type: 'boolean' } }) },
  { name: 'explainEdge', phase: 'completed', annotations: { readOnlyHint: true },
    description: 'Explain the relationship on the edge between two node ids (label, relation type, note).',
    inputSchema: S({ sourceId: { type: 'string' }, targetId: { type: 'string' } }, ['sourceId', 'targetId']) },
  { name: 'listCapabilities', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List what this page can do: case analysis and contract compliance review, their steps and start tools, plus the capability now open.',
    inputSchema: S({}) },
  { name: 'selectCapability', phase: 'base', annotations: {},
    description: 'Open one capability on this page: case analysis or contract compliance review. Does not start work; use the matching start tool next.',
    inputSchema: S({ mode: { type: 'string', enum: ['case', 'contract'], description: 'case = dispute analysis; contract = compliance review.' } }, ['mode']) },
  { name: 'startContractReview', phase: 'base', annotations: {},
    description: 'Start one contract compliance review from contractText or a sampleId. Only use when no case is active; never replace an active case.',
    inputSchema: S({ contractText: { type: 'string', minLength: 20, description: 'Full contract text to review.' },
      sampleId: { type: 'string', description: 'Exact id or title returned by listSampleCases in contract mode.' },
      party: { type: 'string', enum: ['partyA', 'partyB', 'unknown'], description: 'Which side the review speaks for.' },
      scopes: { type: 'array', description: 'Review scopes; empty lets the reviewer decide.', items: { type: 'string', enum: [...CONTRACT_SCOPES] } },
      outputs: { type: 'array', description: 'Extra outputs besides the report.', items: { type: 'string', enum: ['revised'] } },
      locale: LOCALE }) },
  { name: 'getComplianceReport', phase: 'completed', annotations: { readOnlyHint: true, untrustedContentHint: true },
    description: 'Return the completed compliance report: overall risk and findings, optionally filtered to one risk level. Long output is summarised.',
    inputSchema: S({ risk: { type: 'string', enum: ['all', 'high', 'medium', 'low'], description: 'Risk level to keep; all keeps every finding.' } }) },
  { name: 'filterFindingsByRisk', phase: 'completed', annotations: {},
    description: 'Filter the visible compliance findings list on the result page by risk level.',
    inputSchema: S({ risk: { type: 'string', enum: ['all', 'high', 'medium', 'low'] } }, ['risk']) },
  { name: 'getUsageStats', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Read aggregated site usage for the last N days: analyses per day, tokens and member counts.',
    inputSchema: S({ days: { type: 'integer', minimum: 1, maximum: 90, description: 'How many days back to summarise.' } }) }
];

/** 各頁面狀態允許 Agent 看到與呼叫的工具；QUESTIONS 只允許填入答案，不允許自動送出或換案。 */
export const TOOL_NAMES_BY_VIEW = Object.freeze({
  // getUsageStats 為唯讀彙總統計，於 HOME／INPUT／RESULT 曝光（流程進行中的頁面不加，避免干擾）
  HOME: Object.freeze(['listCapabilities', 'selectCapability', 'startCase', 'startContractReview', 'listSampleCases', 'verifyCitation', 'getUsageStats']),
  INPUT: Object.freeze(['listSampleCases', 'startCase', 'setOutputSelection', 'getOutputOptions', 'getInputForm', 'verifyCitation', 'listCapabilities', 'selectCapability', 'startContractReview', 'getUsageStats']),
  RUNNING: Object.freeze(['getCaseStatus', 'resetCase']),
  QUESTIONS: Object.freeze(['getCaseStatus', 'getQuestions', 'fillQuestions', 'resetCase']),
  RESULT: Object.freeze(['getCaseStatus', 'getResultTabs', 'getAnalysis', 'getGraphSummary', 'focusNode', 'filterGraph', 'explainEdge', 'verifyCitation', 'resetCase', 'getComplianceReport', 'filterFindingsByRisk', 'getUsageStats']),
  FAILED: Object.freeze(['getCaseStatus', 'resetCase'])
});

/** 回傳長度護欄：JSON 字串化超過 max 字元時改回摘要。 */
export function truncate(obj, max = 1500) {
  const s = JSON.stringify(obj);
  if (s.length <= max) return obj;
  return { truncated: true, summary: s.slice(0, max - 120) + '…', hint: 'Use a narrower section or focusNode for details.' };
}

/** 取得瀏覽器可用的 WebMCP modelContext；兼容 Chrome 149 舊版 navigator 介面。 */
export function resolveModelContext(runtime = globalThis) {
  return runtime.document?.modelContext ?? runtime.navigator?.modelContext;
}

/**
 * 偵測 host 晚注入的 modelContext：Agent 瀏覽器（如 ChatGPT Site tools）可能在頁面腳本
 * 執行後才提供 API，啟動時檢查一次會誤判「不可用」。輪詢直到出現（只回呼一次）或逾時；
 * 回傳 stop() 供頁面離開時清理。
 */
export function watchModelContext(runtime, onFound, { intervalMs = 500, timeoutMs = 20000 } = {}) {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const mc = resolveModelContext(runtime);
    if (mc) {
      clearInterval(timer);
      onFound(mc);
    } else if (Date.now() - startedAt >= timeoutMs) {
      clearInterval(timer);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

/**
 * 建立 WebMCP 控制器；modelContext 可注入假物件測試。
 * ready：app 尚未綁定前（webmcp-bundle.js 比 app-bundle.js 先載入）所有 execute 先等此 promise，
 * 讓工具能在頁面最早期就註冊給 Agent host，實際執行則等應用層就緒。
 */
export function createWebMcp({ app, graphView, modelContext, ready = Promise.resolve() }) {
  /** 目前接上的 host modelContext；可由 attachModelContext 於晚注入時補上。 */
  let hostContext = modelContext;
  /** 同一狀態的註冊共用一個 AbortController，切換狀態時可一次解除舊工具。 */
  let controller = null;
  /** 目前已註冊且可供 Agent 使用的工具名稱。 */
  const registered = new Set();
  /** 目前工具清單所對應的頁面狀態。 */
  let activeView = null;

  /** 兼容部分 Agent host 將工具參數以 JSON 字串傳入的行為。 */
  function normalizeInput(input) {
    if (!input) return {};
    let value = input;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return {}; }
    }
    if (value && typeof value === 'object' && value.arguments !== undefined) return normalizeInput(value.arguments);
    return value;
  }

  /** 取得目前頁面狀態；測試中的最小 app 也能使用預設 INPUT。 */
  function currentView() {
    return app.getState?.()?.view || activeView || 'INPUT';
  }

  /** 判斷工具是否屬於目前頁面狀態，避免舊 host callback 跨狀態繼續執行。 */
  function isToolAvailable(name, view = currentView()) {
    return (TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT).includes(name);
  }

  /** 將頁面 view 轉成 Agent 可直接判斷的案件狀態。 */
  function pageStatus() {
    const page = app.getState?.() || {};
    const last = page.last || {};
    const status = last.status || ({ HOME: 'NONE', INPUT: 'NONE', RUNNING: 'RUNNING', QUESTIONS: 'WAITING', RESULT: 'COMPLETED', FAILED: 'FAILED' }[page.view] || 'NONE');
    const waiting = status === 'WAITING' || page.view === 'QUESTIONS';
    const active = status !== 'NONE';
    const questionProgress = app.getQuestionProgress?.() || { filledQuestionCount: 0, questionCount: 0, missingQuestionIds: [] };
    const allQuestionsFilled = waiting && questionProgress.questionCount > 0 && questionProgress.missingQuestionIds.length === 0;
    return {
      caseId: last.caseId || page.caseId || null,
      status,
      step: last.step || (status === 'RUNNING' ? 'BRAINSTORM' : status === 'WAITING' ? 'QUESTIONS' : null),
      locale: last.locale || app.getLocale?.(),
      view: page.view || 'INPUT',
      // 目前開啟的能力（case／contract），HOME 尚未選擇時為 null
      mode: app.getMode?.() || null,
      humanActionRequired: waiting,
      questionCount: questionProgress.questionCount || (Array.isArray(last.questions) ? last.questions.length : 0),
      filledQuestionCount: questionProgress.filledQuestionCount || 0,
      missingQuestionIds: questionProgress.missingQuestionIds || [],
      nextAction: waiting
        ? allQuestionsFilled
          ? 'Answers are filled in the visible fields. Ask the human to review and click Continue. Do not call startCase or submit another case.'
          : 'Ask the human for answers, or use fillQuestions to place proposed answers in the visible fields. The human must review and submit; do not call startCase or submit another case.'
        : active
          ? status === 'RUNNING'
            ? 'Poll getCaseStatus until WAITING, COMPLETED, or FAILED. Do not call startCase while this case is active.'
            : status === 'COMPLETED'
              ? 'Use getAnalysis or graph tools for this completed case.'
              : 'Show the failure and wait for the human before retrying or resetting.'
          : (page.view || 'INPUT') === 'HOME'
            ? 'Call listCapabilities, then selectCapability or a start tool.'
            : 'Call startCase with caseText or sampleId to begin one case.'
    };
  }

  /** 產生 Agent 可直接理解的題目對照與 fillQuestions 輸入範例。 */
  function questionGuide() {
    const page = app.getState?.() || {};
    const last = page.last || {};
    const questions = Array.isArray(last.questions) ? last.questions : [];
    const progress = app.getQuestionProgress?.() || { missingQuestionIds: [] };
    const missing = new Set(progress.missingQuestionIds || []);
    return {
      view: page.view || 'INPUT',
      status: last.status || null,
      questions: questions.map((question) => ({
        questionId: question.id,
        question: question.text,
        why: question.why,
        filled: !missing.has(question.id)
      })),
      fillQuestionsExample: {
        answers: questions.map((question) => ({ questionId: question.id, answer: '' }))
      },
      nextAction: 'Use fillQuestions with the questionId values above. Filling only updates the visible fields; a human must review and click Continue.'
    };
  }

  /** 回傳一致的不可用結果，讓 Agent 知道應依目前頁面狀態行動。 */
  function unavailable(name) {
    const current = pageStatus();
    return {
      ok: false,
      error: 'TOOL_UNAVAILABLE',
      message: `${name} is not available in page state ${current.view}. Use only the tools currently exposed by this page.`,
      current,
      nextAction: current.nextAction
    };
  }

  /** 各工具的 execute：只呼叫 app／graphView 的領域函式，不碰 DOM。 */
  const exec = {
    listSampleCases: async ({ locale }) => {
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      return app.getSamples().map(({ id, title, summary }) => ({ id, title, summary }));
    },
    startCase: async ({ caseText, sampleId, locale, documents, motionRequest }) => {
      // 合約審查表單開著時不接受案件分析啟動，避免送出到錯誤的能力
      if (app.getMode?.() === 'contract' && currentView() === 'INPUT') {
        return { ok: false, error: 'WRONG_CAPABILITY', message: 'The contract review form is open. Use startContractReview, or selectCapability("case") first.' };
      }
      if (!['HOME', 'INPUT'].includes(currentView())) {
        const current = pageStatus();
        return {
          ok: false,
          error: 'CASE_IN_PROGRESS',
          message: 'A case is already active on this page. Keep the current case; do not send another sample.',
          current,
          nextAction: current.nextAction
        };
      }
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      // 從 HOME 直接啟動時先選案件分析能力，讓流程走案件分析
      if (app.getMode?.() !== 'case' && currentView() === 'HOME') await app.selectMode?.('case');
      // 關聯圖為 Agent 啟動時的預設輸出；documents 另外加上勾選書狀
      const outputs = ['graph', ...(Array.isArray(documents) ? documents : [])];
      const s = sampleId ? await app.startSample(sampleId, outputs) : await app.start(caseText, outputs, [], motionRequest || '');
      if (!s) return { ok: false, error: 'Unknown sampleId or empty caseText.' };
      return {
        ok: true,
        caseId: s.caseId,
        status: s.status,
        step: s.step,
        nextAction: 'Poll getCaseStatus. If it returns WAITING, ask the human to answer the visible questions; do not start another case.'
      };
    },
    setOutputSelection: async ({ outputs } = {}) => {
      if (!isToolAvailable('setOutputSelection')) return unavailable('setOutputSelection');
      return app.setOutputs(outputs);
    },
    getOutputOptions: async () => {
      if (!isToolAvailable('getOutputOptions')) return unavailable('getOutputOptions');
      return app.getOutputOptions();
    },
    getInputForm: async () => {
      if (!isToolAvailable('getInputForm')) return unavailable('getInputForm');
      // 不套 1500 字元護欄：9 個選項＋標籤本身就近上限；案情文字改由 app 端截短並標示
      return app.getInputForm();
    },
    getResultTabs: async () => {
      if (!isToolAvailable('getResultTabs')) return unavailable('getResultTabs');
      return app.getResultTabs();
    },
    getCaseStatus: async () => {
      const page = app.getState?.() || {};
      const last = page.last;
      if (!last) return pageStatus();
      const { result, ...rest } = last;
      // 不夾帶全文；改列出已可讀取的段落（進行中即有中間成果），完整內容用 getAnalysis 取
      const sections = result ? ['brainstorm', 'research', 'analysis', 'documents', 'graph'].filter((k) => result[k]) : [];
      return truncate({
        ...rest,
        ...pageStatus(),
        hasResult: Boolean(result),
        sections,
        questions: rest.questions
      });
    },
    getQuestions: async () => {
      if (!isToolAvailable('getQuestions')) return unavailable('getQuestions');
      return truncate(questionGuide());
    },
    fillQuestions: async (input = {}) => app.fillQuestions(input.answers),
    verifyCitation: async ({ ref }) => truncate(await app.verify(ref)),
    resetCase: async () => { app.reset(); return { ok: true }; },
    getAnalysis: async ({ section }) => truncate(app.getState().last?.result?.[section] ?? { error: 'not completed' }),
    getGraphSummary: async () => truncate(graphView.summary() ?? { error: 'graph not rendered' }),
    focusNode: async ({ nodeId, label }) => truncate(graphView.focus(nodeId || label) ?? { error: 'node not found' }),
    filterGraph: async (args) => graphView.filter(args) ?? { error: 'graph not rendered' },
    explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: 'edge not found' },
    /** 列出本頁兩種能力、各自流程步驟與啟動工具，以及目前開啟的能力。 */
    listCapabilities: async () => ({ ok: true, view: currentView(), current: app.getMode?.() || null,
      capabilities: [{ mode: 'case', title: 'Case analysis', steps: ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'ASSESSMENT', 'DOCUMENTS', 'GRAPH'], startTool: 'startCase' },
        { mode: 'contract', title: 'Contract compliance review', steps: ['LOAD', 'QUESTIONS', 'RESEARCH', 'REVIEW', 'SUMMARY', 'REVISE', 'GRAPH'], startTool: 'startContractReview' }],
      nextAction: 'Call selectCapability to open a capability, or its start tool directly.' }),
    /** 開啟指定能力（只在 HOME／INPUT 可用）。 */
    selectCapability: async ({ mode }) => {
      if (!['HOME', 'INPUT'].includes(currentView())) return unavailable('selectCapability');
      await app.selectMode(mode); return { ok: true, mode, view: currentView() };
    },
    /** 啟動一次合約合規審查；必要時先切換到合約能力。 */
    startContractReview: async ({ contractText, sampleId, party, scopes, outputs, locale }) => {
      if (!['HOME', 'INPUT'].includes(currentView())) { const c = pageStatus(); return { ok: false, error: 'CASE_IN_PROGRESS', current: c, nextAction: c.nextAction }; }
      // 案件分析表單開著時不靜默切換能力，要求 Agent 明確選擇（與 startCase 的守衛對稱）
      if (app.getMode?.() === 'case' && currentView() === 'INPUT') {
        return { ok: false, error: 'WRONG_CAPABILITY', message: 'The case analysis form is open. Use startCase, or selectCapability("contract") first.' };
      }
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      if (app.getMode?.() !== 'contract') await app.selectMode('contract');
      const extra = { party: party || 'unknown', scopes: Array.isArray(scopes) ? scopes : [] };
      const s = sampleId ? await app.startSample(sampleId, outputs || [], extra) : await app.start(contractText, outputs || [], [], '', extra);
      if (!s) return { ok: false, error: 'Unknown sampleId or empty contractText.' };
      return { ok: true, caseId: s.caseId, status: s.status, step: s.step, mode: 'contract', nextAction: 'Poll getCaseStatus; on COMPLETED call getComplianceReport.' };
    },
    /** 讀取已完成的合規報告，可依風險等級過濾 findings。 */
    getComplianceReport: async ({ risk = 'all' } = {}) => {
      const c = app.getState().last?.result?.compliance; if (!c) return { error: 'not completed' };
      return truncate({ ...c, findings: (c.findings || []).filter((f) => risk === 'all' || f.risk === risk) }, 4000);
    },
    /** 依風險等級過濾結果頁上顯示的 findings 清單。 */
    filterFindingsByRisk: async ({ risk }) => {
      // 只有合約模式的完成結果頁才有風險清單可篩選
      if (currentView() !== 'RESULT' || app.getMode?.() !== 'contract') {
        return { ok: false, error: 'TOOL_UNAVAILABLE', message: 'Risk filter applies to a completed contract review only.' };
      }
      app.setRiskFilter?.(risk); return { ok: true, risk };
    },
    /** 近 N 日站台使用統計（1～90 日，預設 30）；應用層未提供時明確回不可用。 */
    getUsageStats: async ({ days } = {}) => {
      if (typeof app.getStats !== 'function') return { ok: false, error: 'NOT_AVAILABLE' };
      try {
        return truncate(await app.getStats(Math.min(90, Math.max(1, Number(days) || 30))), 4000);
      } catch (e) {
        // 後端未提供或逾時：明確回報失敗，不讓 Agent 誤以為統計為空
        return { ok: false, error: 'STATS_UNAVAILABLE', message: e?.message || String(e) };
      }
    }
  };

  /** 註冊串行化：早期啟動器與應用層可能同時呼叫 syncForState，排隊避免舊註冊插隊覆蓋。 */
  let syncQueue = Promise.resolve();
  /** 註冊某個頁面狀態的工具，切換時解除上一狀態，讓 Agent 取得即時工具清單（呼叫會依序執行）。 */
  function syncForState(view) {
    const run = syncQueue.then(() => syncForStateNow(view));
    syncQueue = run.catch(() => {});
    return run;
  }
  async function syncForStateNow(view) {
    const nextView = TOOL_NAMES_BY_VIEW[view] ? view : 'INPUT';
    const desired = TOOL_NAMES_BY_VIEW[nextView];
    const unchanged = activeView === nextView && registered.size === desired.length && desired.every((name) => registered.has(name));
    if (unchanged) return [...registered];

    controller?.abort();
    controller = new AbortController();
    registered.clear();
    for (const name of desired) {
      const def = TOOL_DEFS.find((candidate) => candidate.name === name);
      if (!def) continue;
      if (hostContext?.registerTool) {
        await hostContext.registerTool({
          name: def.name, description: def.description, inputSchema: def.inputSchema, annotations: def.annotations,
          execute: async (input) => {
            await ready;
            return isToolAvailable(def.name) ? exec[def.name](normalizeInput(input)) : unavailable(def.name);
          }
        }, { signal: controller.signal });
      }
      registered.add(def.name);
    }
    activeView = nextView;
    return [...registered];
  }

  return {
    /** 相容舊呼叫端：輸入頁工具等同 INPUT 狀態。 */
    registerBase: () => syncForState('INPUT'),
    /** 相容舊呼叫端：完成頁工具等同 RESULT 狀態。 */
    registerCompleted: () => syncForState('RESULT'),
    /** 依 app view 同步目前可用工具；回傳實際註冊名稱供測試與 Inspector 使用。 */
    syncForState,
    /** host 晚注入 modelContext 時補接上並重新註冊目前狀態的工具。 */
    attachModelContext: (next) => {
      hostContext = next;
      const view = app.getState?.()?.view || activeView || 'INPUT';
      activeView = null; // 強制重跑註冊，即使 view 沒變
      return syncForState(view);
    },
    /** 是否已接上可註冊工具的 host。 */
    hasHost: () => Boolean(hostContext?.registerTool),
    /** 全部解除，通常只在頁面離開或測試清理時使用。 */
    unregisterAll: () => { controller?.abort(); controller = null; registered.clear(); activeView = null; },
    tools: () => [...registered],
    pageStatus,
    questionGuide,
    availableForState: (view) => [...(TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT)],
    /** Inspector 與測試用：直接執行某工具。 */
    execute: async (name, input) => { await ready; return exec[name](normalizeInput(input)); }
  };
}
