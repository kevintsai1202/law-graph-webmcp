import { CONTRACT_OUTPUTS } from './contract.js';

/** 八種可勾選書狀的代碼（與後端 DocumentTypes.CODES 同序）；'graph' 另計為關聯圖輸出。 */
export const DOC_TYPES = Object.freeze([
  'complaint', 'reasons', 'report', 'preparatory', 'defense', 'issues', 'appeal', 'motion'
]);

/** 全部輸出選項的固定順序：關聯圖在前，其後為八種書狀。 */
export const OUTPUT_OPTIONS = Object.freeze(['graph', ...DOC_TYPES]);

/** 依模式回輸出選項清單：合約模式只有「修訂本」，其餘（案件模式）維持原本順序。 */
export function outputOptionsFor(mode = 'case') {
  return mode === 'contract' ? [...CONTRACT_OUTPUTS] : [...OUTPUT_OPTIONS];
}

/** 正規化輸出勾選：case 模式過濾未知值、依固定順序排序，空清單退回只有關聯圖；contract 模式只留 revised，允許為空清單。 */
export function normalizeOutputs(outputs, mode = 'case') {
  const requested = new Set(Array.isArray(outputs) ? outputs : []);
  if (mode === 'contract') return CONTRACT_OUTPUTS.filter((o) => requested.has(o));
  const ordered = OUTPUT_OPTIONS.filter((o) => requested.has(o));
  return ordered.length ? ordered : ['graph'];
}
