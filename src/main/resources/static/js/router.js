/** hash 路由：#/（首頁）、#/case、#/contract。純函式，app.js 負責監聽 hashchange 與寫回 location.hash。 */
export const MODES = Object.freeze(['case', 'contract']);

/** 解析 location.hash；未知路徑回首頁。 */
export function parseHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '');
  return MODES.includes(path) ? { view: 'INPUT', mode: path } : { view: 'HOME', mode: null };
}

/** 由狀態推回 hash：有 mode 的任何流程頁都落在該 mode 路徑。 */
export function hashFor(state) {
  return state?.view !== 'HOME' && MODES.includes(state?.mode) ? `#/${state.mode}` : '#/';
}
