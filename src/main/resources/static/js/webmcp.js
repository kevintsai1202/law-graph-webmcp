/** WebMCP 工具層：依頁面狀態註冊可用工具；沒有代答工具。 */

/** 產生 object 型 inputSchema（一律 additionalProperties:false）。 */
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
/** 共用的語系參數。 */
const LOCALE = { type: 'string', enum: ['en', 'zh-TW'], description: 'Output language' };

/** 十二個工具的穩定契約（不含 execute，可在 node 驗證）。phase 保留供文件與相容性使用。 */
export const TOOL_DEFS = [
  { name: 'listSampleCases', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List the built-in fictional sample disputes that can be analysed with startCase.',
    inputSchema: S({ locale: LOCALE }) },
  { name: 'startCase', phase: 'base', annotations: {},
    description: 'Start one Taiwan legal dispute from caseText or a sampleId. Only use when the page is in INPUT; never replace an active case.',
    inputSchema: S({ caseText: { type: 'string', minLength: 20 }, sampleId: { type: 'string', description: 'Exact id or title returned by listSampleCases, e.g. car-accident.' }, locale: LOCALE }) },
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
    inputSchema: S({ section: { type: 'string', enum: ['brainstorm', 'research', 'analysis'] } }, ['section']) },
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
    inputSchema: S({ sourceId: { type: 'string' }, targetId: { type: 'string' } }, ['sourceId', 'targetId']) }
];

/** 各頁面狀態允許 Agent 看到與呼叫的工具；QUESTIONS 只允許填入答案，不允許自動送出或換案。 */
export const TOOL_NAMES_BY_VIEW = Object.freeze({
  INPUT: Object.freeze(['listSampleCases', 'startCase', 'verifyCitation']),
  RUNNING: Object.freeze(['getCaseStatus', 'resetCase']),
  QUESTIONS: Object.freeze(['getCaseStatus', 'getQuestions', 'fillQuestions', 'resetCase']),
  RESULT: Object.freeze(['getCaseStatus', 'getAnalysis', 'getGraphSummary', 'focusNode', 'filterGraph', 'explainEdge', 'verifyCitation', 'resetCase']),
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

/** 建立 WebMCP 控制器；modelContext 可注入假物件測試。 */
export function createWebMcp({ app, graphView, modelContext }) {
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
    const status = last.status || ({ INPUT: 'NONE', RUNNING: 'RUNNING', QUESTIONS: 'WAITING', RESULT: 'COMPLETED', FAILED: 'FAILED' }[page.view] || 'NONE');
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
    startCase: async ({ caseText, sampleId, locale }) => {
      if (app.getState().view !== 'INPUT') {
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
      const s = sampleId ? await app.startSample(sampleId) : await app.start(caseText);
      if (!s) return { ok: false, error: 'Unknown sampleId or empty caseText.' };
      return {
        ok: true,
        caseId: s.caseId,
        status: s.status,
        step: s.step,
        nextAction: 'Poll getCaseStatus. If it returns WAITING, ask the human to answer the visible questions; do not start another case.'
      };
    },
    getCaseStatus: async () => {
      const page = app.getState?.() || {};
      const last = page.last;
      if (!last) return pageStatus();
      const { result, ...rest } = last;
      // 不夾帶全文；改列出已可讀取的段落（進行中即有中間成果），完整內容用 getAnalysis 取
      const sections = result ? ['brainstorm', 'research', 'analysis', 'graph'].filter((k) => result[k]) : [];
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
    explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: 'edge not found' }
  };

  /** 註冊某個頁面狀態的工具，切換時解除上一狀態，讓 Agent 取得即時工具清單。 */
  async function syncForState(view) {
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
      if (modelContext?.registerTool) {
        await modelContext.registerTool({
          name: def.name, description: def.description, inputSchema: def.inputSchema, annotations: def.annotations,
          execute: (input) => isToolAvailable(def.name) ? exec[def.name](normalizeInput(input)) : unavailable(def.name)
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
    /** 全部解除，通常只在頁面離開或測試清理時使用。 */
    unregisterAll: () => { controller?.abort(); controller = null; registered.clear(); activeView = null; },
    tools: () => [...registered],
    pageStatus,
    questionGuide,
    availableForState: (view) => [...(TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT)],
    /** Inspector 與測試用：直接執行某工具。 */
    execute: (name, input) => exec[name](normalizeInput(input))
  };
}
