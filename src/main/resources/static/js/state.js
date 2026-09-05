/** 頁面狀態機：純函式，方便測試。HOME 為能力入口（案件分析／合約審查）。 */
export const States = Object.freeze({ HOME: 'HOME', INPUT: 'INPUT', RUNNING: 'RUNNING', QUESTIONS: 'QUESTIONS', RESULT: 'RESULT', FAILED: 'FAILED', STATS: 'STATS' });

/** 後端 CaseStatus.status → 畫面 view 的對照。 */
const VIEW_BY_STATUS = { RUNNING: States.RUNNING, WAITING: States.QUESTIONS, COMPLETED: States.RESULT, FAILED: States.FAILED };

/** 兩條流程的模式代碼；未知一律退回 case。 */
export const normalizeMode = (mode) => (mode === 'contract' ? 'contract' : 'case');

/** 初始狀態：首頁，尚未選能力。 */
export const initialState = Object.freeze({ view: States.HOME, caseId: null, last: null, mode: null });

/** 依事件產生新狀態；未知事件回原狀態。 */
export function reduce(state, event) {
  switch (event.type) {
    case 'SELECT_MODE': return { view: States.INPUT, caseId: null, last: null, mode: normalizeMode(event.mode) };
    case 'GO_HOME': return { ...initialState };
    case 'START': return { view: States.RUNNING, caseId: event.caseId, last: null, mode: normalizeMode(event.mode ?? state.mode) };
    // 統計頁為唯讀分頁：輪詢回報只更新 last／mode，不把使用者踢回案件畫面；
    // 離開統計頁時由 app.js 帶 leaveStats 旗標的同一事件還原案件畫面
    case 'STATUS': return { ...state,
      view: state.view === States.STATS && !event.leaveStats ? States.STATS : (VIEW_BY_STATUS[event.status.status] || state.view),
      last: event.status, mode: event.status.mode ? normalizeMode(event.status.mode) : state.mode };
    // 統計頁為唯讀分頁：保留 mode／caseId，離開後才能回到原本的案件畫面
    case 'SHOW_STATS': return { ...state, view: States.STATS };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}
