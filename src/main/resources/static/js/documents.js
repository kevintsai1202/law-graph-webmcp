/** 八種可勾選書狀的代碼（與後端 DocumentTypes.CODES 同序）；'graph' 另計為關聯圖輸出。 */
export const DOC_TYPES = Object.freeze([
  'complaint', 'reasons', 'report', 'preparatory', 'defense', 'issues', 'appeal', 'motion'
]);

/** 全部輸出選項的固定順序：關聯圖在前，其後為八種書狀。 */
export const OUTPUT_OPTIONS = Object.freeze(['graph', ...DOC_TYPES]);

/** 正規化輸出勾選：過濾未知值、依固定順序排序；空清單退回只有關聯圖。 */
export function normalizeOutputs(outputs) {
  const requested = new Set(Array.isArray(outputs) ? outputs : []);
  const ordered = OUTPUT_OPTIONS.filter((o) => requested.has(o));
  return ordered.length ? ordered : ['graph'];
}
