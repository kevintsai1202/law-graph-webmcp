/** WebMCP 工具層：只用 Imperative registerTool；圖操作工具於 COMPLETED 後才註冊；沒有代答工具。 */

/** 產生 object 型 inputSchema（一律 additionalProperties:false）。 */
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
/** 共用的語系參數。 */
const LOCALE = { type: 'string', enum: ['en', 'zh-TW'], description: 'Output language' };

/** 十個工具的穩定契約（不含 execute，可在 node 驗證）。phase: base＝進頁即註冊；completed＝分析完成後才註冊。 */
export const TOOL_DEFS = [
  { name: 'listSampleCases', phase: 'base', annotations: { readOnlyHint: true },
    description: 'List the built-in fictional sample disputes that can be analysed with startCase.',
    inputSchema: S({ locale: LOCALE }) },
  { name: 'startCase', phase: 'base', annotations: {},
    description: 'Start analysing a Taiwan legal dispute from free text or a sample id. Returns caseId and status.',
    inputSchema: S({ caseText: { type: 'string', minLength: 20 }, sampleId: { type: 'string' }, locale: LOCALE }) },
  { name: 'getCaseStatus', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Poll the current case: RUNNING step, WAITING with questions the human must answer on the page, COMPLETED or FAILED.',
    inputSchema: S({}) },
  { name: 'verifyCitation', phase: 'base', annotations: { readOnlyHint: true },
    description: 'Check whether a Taiwan statute article or judgment citation exists in official databases.',
    inputSchema: S({ ref: { type: 'string', description: 'e.g. 民法第184條 or 最高法院108年度台上字第2345號' } }, ['ref']) },
  { name: 'resetCase', phase: 'base', annotations: {},
    description: 'Discard the current case and return the page to the input screen.',
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

/** 回傳長度護欄：JSON 字串化超過 max 字元時改回摘要。 */
export function truncate(obj, max = 1500) {
  const s = JSON.stringify(obj);
  if (s.length <= max) return obj;
  return { truncated: true, summary: s.slice(0, max - 120) + '…', hint: 'Use a narrower section or focusNode for details.' };
}

/** 建立 WebMCP 控制器；modelContext（document.modelContext）可注入假物件測試。 */
export function createWebMcp({ app, graphView, modelContext }) {
  /** 同一批註冊共用一個 AbortController，abort 即全部解除。 */
  let controller = null;
  /** 目前已註冊的工具名稱。 */
  const registered = new Set();

  /** 各工具的 execute：只呼叫 app／graphView 的領域函式，不碰 DOM。 */
  const exec = {
    listSampleCases: async ({ locale }) => {
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      return app.getSamples().map(({ id, title, summary }) => ({ id, title, summary }));
    },
    startCase: async ({ caseText, sampleId, locale }) => {
      if (app.getState().view !== 'INPUT') return { ok: false, error: 'A case is in progress. Call resetCase first.' };
      if (locale && locale !== app.getLocale()) await app.setLocale(locale);
      const s = sampleId ? await app.startSample(sampleId) : await app.start(caseText);
      if (!s) return { ok: false, error: 'Unknown sampleId or empty caseText.' };
      return { ok: true, caseId: s.caseId, status: s.status, step: s.step };
    },
    getCaseStatus: async () => {
      const last = app.getState().last;
      if (!last) return { status: 'NONE', hint: 'No case yet. Call startCase.' };
      const { result, ...rest } = last;
      return truncate(result ? { ...rest, hasResult: true } : rest);
    },
    verifyCitation: async ({ ref }) => truncate(await app.verify(ref)),
    resetCase: async () => { app.reset(); return { ok: true }; },
    getAnalysis: async ({ section }) => truncate(app.getState().last?.result?.[section] ?? { error: 'not completed' }),
    getGraphSummary: async () => truncate(graphView.summary() ?? { error: 'graph not rendered' }),
    focusNode: async ({ nodeId, label }) => truncate(graphView.focus(nodeId || label) ?? { error: 'node not found' }),
    filterGraph: async (args) => graphView.filter(args) ?? { error: 'graph not rendered' },
    explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: 'edge not found' }
  };

  /** 註冊某階段尚未註冊的工具；無 WebMCP 環境時靜默略過（Inspector 仍可用 execute）。 */
  async function registerPhase(phase) {
    if (!modelContext?.registerTool) return;
    controller ??= new AbortController();
    for (const def of TOOL_DEFS.filter((d) => d.phase === phase && !registered.has(d.name))) {
      await modelContext.registerTool({
        name: def.name, description: def.description, inputSchema: def.inputSchema, annotations: def.annotations,
        execute: (input) => exec[def.name](input || {})
      }, { signal: controller.signal });
      registered.add(def.name);
    }
  }

  return {
    registerBase: () => registerPhase('base'),
    registerCompleted: () => registerPhase('completed'),
    /** 全部解除（同一 AbortController），之後可重新 registerBase。 */
    unregisterAll: () => { controller?.abort(); controller = null; registered.clear(); },
    tools: () => [...registered],
    /** Inspector 與測試用：直接執行某工具。 */
    execute: (name, input) => exec[name](input || {})
  };
}
