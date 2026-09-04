(() => {
  // src/main/resources/static/js/documents.js
  var DOC_TYPES = Object.freeze([
    "complaint",
    "reasons",
    "report",
    "preparatory",
    "defense",
    "issues",
    "appeal",
    "motion"
  ]);
  var OUTPUT_OPTIONS = Object.freeze(["graph", ...DOC_TYPES]);

  // src/main/resources/static/js/webmcp.js
  var S = (props, required = []) => ({ type: "object", properties: props, required, additionalProperties: false });
  var LOCALE = { type: "string", enum: ["en", "zh-TW"], description: "Output language" };
  var TOOL_DEFS = [
    {
      name: "listSampleCases",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "List the built-in fictional sample disputes that can be analysed with startCase.",
      inputSchema: S({ locale: LOCALE })
    },
    {
      name: "startCase",
      phase: "base",
      annotations: {},
      description: "Start one Taiwan legal dispute from caseText or a sampleId. Only use when the page is in INPUT; never replace an active case.",
      inputSchema: S({
        caseText: { type: "string", minLength: 20 },
        sampleId: { type: "string", description: "Exact id or title returned by listSampleCases, e.g. car-accident." },
        motionRequest: { type: "string", description: "Only with documents containing motion: what the court is asked to grant, e.g. \u8072\u8ACB\u8ABF\u67E5\u8B49\u64DA." },
        locale: LOCALE,
        documents: { type: "array", description: "Litigation documents to draft besides the graph, e.g. complaint (\u8D77\u8A34\u72C0), defense (\u7B54\u8FAF\u72C0).", items: { type: "string", enum: [...DOC_TYPES] } }
      })
    },
    {
      name: "setOutputSelection",
      phase: "base",
      annotations: {},
      description: 'Tick the "outputs to generate" checkboxes on the input form (graph and Taiwan pleading types). Does not start the case.',
      inputSchema: S({ outputs: { type: "array", minItems: 1, description: "Outputs to tick; unlisted ones are unticked.", items: { type: "string", enum: ["graph", ...DOC_TYPES] } } }, ["outputs"])
    },
    {
      name: "getOutputOptions",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: 'List the "outputs to generate" checkboxes shown on the input form: count, code, label, and which are ticked.',
      inputSchema: S({})
    },
    {
      name: "getInputForm",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Read everything shown on the input page: typed case text, character count, minimum, submit state, output checkboxes and sample count.",
      inputSchema: S({})
    },
    {
      name: "getResultTabs",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "List the tabs shown on the result page (graph, drafted documents, analysis, research, brainstorm), which is active and which have content.",
      inputSchema: S({})
    },
    {
      name: "getCaseStatus",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Read the current page case state. WAITING means the human must answer visible questions; call getQuestions before filling.",
      inputSchema: S({})
    },
    {
      name: "getQuestions",
      phase: "questions",
      annotations: { readOnlyHint: true },
      description: "List each visible question with its questionId and the exact fillQuestions answer format. Call before filling.",
      inputSchema: S({})
    },
    {
      name: "fillQuestions",
      phase: "questions",
      annotations: {},
      description: "Fill proposed answers into visible fields using questionId from getQuestions. Does not submit; a human must review and click Continue.",
      inputSchema: S({ answers: { type: "array", description: "One item per visible question; use questionId returned by getQuestions.", items: S({ questionId: { type: "string", description: "The exact questionId returned by getQuestions, such as q1." }, answer: { type: "string", description: "Proposed answer text for that question." } }, ["questionId", "answer"]) } }, ["answers"])
    },
    {
      name: "verifyCitation",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Check whether a Taiwan statute article or judgment citation exists in official databases.",
      inputSchema: S({ ref: { type: "string", description: "e.g. \u6C11\u6CD5\u7B2C184\u689D or \u6700\u9AD8\u6CD5\u9662108\u5E74\u5EA6\u53F0\u4E0A\u5B57\u7B2C2345\u865F" } }, ["ref"])
    },
    {
      name: "resetCase",
      phase: "base",
      annotations: {},
      description: "Discard the current case and return to input. Use only after the human explicitly asks to abandon it; never replace a WAITING case automatically.",
      inputSchema: S({})
    },
    {
      name: "getAnalysis",
      phase: "completed",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: "Return one section of the completed analysis: brainstorm, research or analysis. Long output is summarised.",
      inputSchema: S({ section: { type: "string", enum: ["brainstorm", "research", "analysis", "documents"] } }, ["section"])
    },
    {
      name: "getGraphSummary",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "Counts by node group, edge count, main issues and elements not yet satisfied.",
      inputSchema: S({})
    },
    {
      name: "focusNode",
      phase: "completed",
      annotations: {},
      description: "Fly the 3D camera to a node (by id or label text), open its detail panel and return its neighbours.",
      inputSchema: S({ nodeId: { type: "string" }, label: { type: "string" } })
    },
    {
      name: "filterGraph",
      phase: "completed",
      annotations: {},
      description: "Show only some node groups (fact, law, judgment, issue, element, ...) or one case family; reset restores all.",
      inputSchema: S({ groups: { type: "array", items: { type: "string" } }, family: { type: "string" }, reset: { type: "boolean" } })
    },
    {
      name: "explainEdge",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "Explain the relationship on the edge between two node ids (label, relation type, note).",
      inputSchema: S({ sourceId: { type: "string" }, targetId: { type: "string" } }, ["sourceId", "targetId"])
    }
  ];
  var TOOL_NAMES_BY_VIEW = Object.freeze({
    INPUT: Object.freeze(["listSampleCases", "startCase", "setOutputSelection", "getOutputOptions", "getInputForm", "verifyCitation"]),
    RUNNING: Object.freeze(["getCaseStatus", "resetCase"]),
    QUESTIONS: Object.freeze(["getCaseStatus", "getQuestions", "fillQuestions", "resetCase"]),
    RESULT: Object.freeze(["getCaseStatus", "getResultTabs", "getAnalysis", "getGraphSummary", "focusNode", "filterGraph", "explainEdge", "verifyCitation", "resetCase"]),
    FAILED: Object.freeze(["getCaseStatus", "resetCase"])
  });
  function truncate(obj, max = 1500) {
    const s = JSON.stringify(obj);
    if (s.length <= max) return obj;
    return { truncated: true, summary: s.slice(0, max - 120) + "\u2026", hint: "Use a narrower section or focusNode for details." };
  }
  function resolveModelContext(runtime = globalThis) {
    return runtime.document?.modelContext ?? runtime.navigator?.modelContext;
  }
  function watchModelContext(runtime, onFound, { intervalMs = 500, timeoutMs = 2e4 } = {}) {
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
  function createWebMcp({ app, graphView, modelContext, ready = Promise.resolve() }) {
    let hostContext = modelContext;
    let controller = null;
    const registered = /* @__PURE__ */ new Set();
    let activeView = null;
    function normalizeInput(input) {
      if (!input) return {};
      let value = input;
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          return {};
        }
      }
      if (value && typeof value === "object" && value.arguments !== void 0) return normalizeInput(value.arguments);
      return value;
    }
    function currentView() {
      return app.getState?.()?.view || activeView || "INPUT";
    }
    function isToolAvailable(name, view = currentView()) {
      return (TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT).includes(name);
    }
    function pageStatus() {
      const page = app.getState?.() || {};
      const last = page.last || {};
      const status = last.status || ({ INPUT: "NONE", RUNNING: "RUNNING", QUESTIONS: "WAITING", RESULT: "COMPLETED", FAILED: "FAILED" }[page.view] || "NONE");
      const waiting = status === "WAITING" || page.view === "QUESTIONS";
      const active = status !== "NONE";
      const questionProgress = app.getQuestionProgress?.() || { filledQuestionCount: 0, questionCount: 0, missingQuestionIds: [] };
      const allQuestionsFilled = waiting && questionProgress.questionCount > 0 && questionProgress.missingQuestionIds.length === 0;
      return {
        caseId: last.caseId || page.caseId || null,
        status,
        step: last.step || (status === "RUNNING" ? "BRAINSTORM" : status === "WAITING" ? "QUESTIONS" : null),
        locale: last.locale || app.getLocale?.(),
        view: page.view || "INPUT",
        humanActionRequired: waiting,
        questionCount: questionProgress.questionCount || (Array.isArray(last.questions) ? last.questions.length : 0),
        filledQuestionCount: questionProgress.filledQuestionCount || 0,
        missingQuestionIds: questionProgress.missingQuestionIds || [],
        nextAction: waiting ? allQuestionsFilled ? "Answers are filled in the visible fields. Ask the human to review and click Continue. Do not call startCase or submit another case." : "Ask the human for answers, or use fillQuestions to place proposed answers in the visible fields. The human must review and submit; do not call startCase or submit another case." : active ? status === "RUNNING" ? "Poll getCaseStatus until WAITING, COMPLETED, or FAILED. Do not call startCase while this case is active." : status === "COMPLETED" ? "Use getAnalysis or graph tools for this completed case." : "Show the failure and wait for the human before retrying or resetting." : "Call startCase with caseText or sampleId to begin one case."
      };
    }
    function questionGuide() {
      const page = app.getState?.() || {};
      const last = page.last || {};
      const questions = Array.isArray(last.questions) ? last.questions : [];
      const progress = app.getQuestionProgress?.() || { missingQuestionIds: [] };
      const missing = new Set(progress.missingQuestionIds || []);
      return {
        view: page.view || "INPUT",
        status: last.status || null,
        questions: questions.map((question) => ({
          questionId: question.id,
          question: question.text,
          why: question.why,
          filled: !missing.has(question.id)
        })),
        fillQuestionsExample: {
          answers: questions.map((question) => ({ questionId: question.id, answer: "" }))
        },
        nextAction: "Use fillQuestions with the questionId values above. Filling only updates the visible fields; a human must review and click Continue."
      };
    }
    function unavailable(name) {
      const current = pageStatus();
      return {
        ok: false,
        error: "TOOL_UNAVAILABLE",
        message: `${name} is not available in page state ${current.view}. Use only the tools currently exposed by this page.`,
        current,
        nextAction: current.nextAction
      };
    }
    const exec = {
      listSampleCases: async ({ locale }) => {
        if (locale && locale !== app.getLocale()) await app.setLocale(locale);
        return app.getSamples().map(({ id, title, summary }) => ({ id, title, summary }));
      },
      startCase: async ({ caseText, sampleId, locale, documents, motionRequest }) => {
        if (app.getState().view !== "INPUT") {
          const current = pageStatus();
          return {
            ok: false,
            error: "CASE_IN_PROGRESS",
            message: "A case is already active on this page. Keep the current case; do not send another sample.",
            current,
            nextAction: current.nextAction
          };
        }
        if (locale && locale !== app.getLocale()) await app.setLocale(locale);
        const outputs = ["graph", ...Array.isArray(documents) ? documents : []];
        const s = sampleId ? await app.startSample(sampleId, outputs) : await app.start(caseText, outputs, [], motionRequest || "");
        if (!s) return { ok: false, error: "Unknown sampleId or empty caseText." };
        return {
          ok: true,
          caseId: s.caseId,
          status: s.status,
          step: s.step,
          nextAction: "Poll getCaseStatus. If it returns WAITING, ask the human to answer the visible questions; do not start another case."
        };
      },
      setOutputSelection: async ({ outputs } = {}) => {
        if (!isToolAvailable("setOutputSelection")) return unavailable("setOutputSelection");
        return app.setOutputs(outputs);
      },
      getOutputOptions: async () => {
        if (!isToolAvailable("getOutputOptions")) return unavailable("getOutputOptions");
        return app.getOutputOptions();
      },
      getInputForm: async () => {
        if (!isToolAvailable("getInputForm")) return unavailable("getInputForm");
        return app.getInputForm();
      },
      getResultTabs: async () => {
        if (!isToolAvailable("getResultTabs")) return unavailable("getResultTabs");
        return app.getResultTabs();
      },
      getCaseStatus: async () => {
        const page = app.getState?.() || {};
        const last = page.last;
        if (!last) return pageStatus();
        const { result, ...rest } = last;
        const sections = result ? ["brainstorm", "research", "analysis", "documents", "graph"].filter((k) => result[k]) : [];
        return truncate({
          ...rest,
          ...pageStatus(),
          hasResult: Boolean(result),
          sections,
          questions: rest.questions
        });
      },
      getQuestions: async () => {
        if (!isToolAvailable("getQuestions")) return unavailable("getQuestions");
        return truncate(questionGuide());
      },
      fillQuestions: async (input = {}) => app.fillQuestions(input.answers),
      verifyCitation: async ({ ref }) => truncate(await app.verify(ref)),
      resetCase: async () => {
        app.reset();
        return { ok: true };
      },
      getAnalysis: async ({ section }) => truncate(app.getState().last?.result?.[section] ?? { error: "not completed" }),
      getGraphSummary: async () => truncate(graphView.summary() ?? { error: "graph not rendered" }),
      focusNode: async ({ nodeId, label }) => truncate(graphView.focus(nodeId || label) ?? { error: "node not found" }),
      filterGraph: async (args) => graphView.filter(args) ?? { error: "graph not rendered" },
      explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: "edge not found" }
    };
    let syncQueue = Promise.resolve();
    function syncForState(view) {
      const run = syncQueue.then(() => syncForStateNow(view));
      syncQueue = run.catch(() => {
      });
      return run;
    }
    async function syncForStateNow(view) {
      const nextView = TOOL_NAMES_BY_VIEW[view] ? view : "INPUT";
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
            name: def.name,
            description: def.description,
            inputSchema: def.inputSchema,
            annotations: def.annotations,
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
      registerBase: () => syncForState("INPUT"),
      /** 相容舊呼叫端：完成頁工具等同 RESULT 狀態。 */
      registerCompleted: () => syncForState("RESULT"),
      /** 依 app view 同步目前可用工具；回傳實際註冊名稱供測試與 Inspector 使用。 */
      syncForState,
      /** host 晚注入 modelContext 時補接上並重新註冊目前狀態的工具。 */
      attachModelContext: (next) => {
        hostContext = next;
        const view = app.getState?.()?.view || activeView || "INPUT";
        activeView = null;
        return syncForState(view);
      },
      /** 是否已接上可註冊工具的 host。 */
      hasHost: () => Boolean(hostContext?.registerTool),
      /** 全部解除，通常只在頁面離開或測試清理時使用。 */
      unregisterAll: () => {
        controller?.abort();
        controller = null;
        registered.clear();
        activeView = null;
      },
      tools: () => [...registered],
      pageStatus,
      questionGuide,
      availableForState: (view) => [...TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT],
      /** Inspector 與測試用：直接執行某工具。 */
      execute: async (name, input) => {
        await ready;
        return exec[name](normalizeInput(input));
      }
    };
  }

  // src/main/resources/static/js/webmcpBoot.js
  function createWebMcpBoot({ runtime = globalThis, watchOptions } = {}) {
    const refs = { app: null, graphView: null };
    const lazy = (key) => new Proxy({}, { get: (_, prop) => refs[key]?.[prop] });
    let resolveReady;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const hostListeners = /* @__PURE__ */ new Set();
    const webmcp = createWebMcp({ app: lazy("app"), graphView: lazy("graphView"), modelContext: resolveModelContext(runtime), ready });
    let initial = webmcp.hasHost() ? webmcp.syncForState("INPUT").catch(() => []) : Promise.resolve([]);
    const stopWatch = webmcp.hasHost() ? null : watchModelContext(runtime, async (late) => {
      await webmcp.attachModelContext(late);
      hostListeners.forEach((cb) => cb(true));
    }, watchOptions);
    return {
      webmcp,
      ready,
      /** 綁定真正的 app／graphView；回傳 webmcp 供入口程式繼續使用。工具仍要等 markReady() 才會執行。 */
      bind(app, graphView) {
        refs.app = app;
        refs.graphView = graphView;
        return webmcp;
      },
      /** app.mount() 完成後呼叫：放行所有等待中的工具呼叫。 */
      markReady() {
        resolveReady();
      },
      /** 是否已綁定應用層。 */
      isBound: () => Boolean(refs.app),
      /** 初次註冊完成的 promise（測試用）。 */
      initialRegistration: () => initial,
      onHost: (cb) => {
        hostListeners.add(cb);
        return () => hostListeners.delete(cb);
      },
      stop() {
        stopWatch?.();
        webmcp.unregisterAll();
      }
    };
  }

  // src/main/resources/static/js/webmcp-entry.js
  var boot = createWebMcpBoot({ runtime: globalThis });
  window.__webmcpBoot = boot;
  window.__webmcp = boot.webmcp;
})();
