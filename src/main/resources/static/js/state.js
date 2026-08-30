/** 頁面狀態機：純函式，方便測試。 */
export const States = Object.freeze({ INPUT: 'INPUT', RUNNING: 'RUNNING', QUESTIONS: 'QUESTIONS', RESULT: 'RESULT', FAILED: 'FAILED' });

/** 後端 CaseStatus.status → 畫面 view 的對照。 */
const VIEW_BY_STATUS = { RUNNING: States.RUNNING, WAITING: States.QUESTIONS, COMPLETED: States.RESULT, FAILED: States.FAILED };

/** 初始狀態：尚無案件。 */
export const initialState = Object.freeze({ view: States.INPUT, caseId: null, last: null });

/** 依事件產生新狀態；未知事件回原狀態。 */
export function reduce(state, event) {
  switch (event.type) {
    case 'START': return { view: States.RUNNING, caseId: event.caseId, last: null };
    case 'STATUS': return { ...state, view: VIEW_BY_STATUS[event.status.status] || state.view, last: event.status };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}
