/** 內嵌 SVG 圖示（Lucide 風格線條、stroke 1.8）：取代 emoji，跟隨 currentColor，一律 aria-hidden 由外層文字提供語意。 */
const wrap = (paths, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = {
  /** 向右箭頭：示範案例卡的進入提示。 */
  arrowRight: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  /** 資訊圓圈：免責聲明。 */
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'),
  /** 警示三角：失敗頁。 */
  alert: wrap('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  /** 關閉叉叉：詳情面板。 */
  close: wrap('<path d="M18 6 6 18M6 6l12 12"/>'),
  /** 向下 V 形：Inspector 折疊切換。 */
  chevronDown: wrap('<path d="m6 9 6 6 6-6"/>'),
  /** 加號：新案件。 */
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  /** 上傳：檔案拖放區的主要視覺提示。 */
  upload: wrap('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/>'),
  /** 送出（紙飛機）：開始分析／繼續。 */
  send: wrap('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
  /** 重試（循環箭頭）。 */
  refresh: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>')
};
