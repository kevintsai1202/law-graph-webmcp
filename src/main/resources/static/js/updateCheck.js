/**
 * 版本更新偵測：啟動時記下 /api/version 的版本當基準，之後定期（與分頁切回前景時）再取一次，
 * 版本不同就呼叫 onUpdate 一次，由呼叫端顯示「網站已更新，請重新載入」橫幅。
 * 任何取版本失敗都靜默略過——這是輔助功能，不能影響頁面本身。
 *
 * @param fetchVersion 回傳版本字串或 { version } 物件的 async 函式（通常是 caseClient.version）
 * @param onUpdate     發現新版本時呼叫一次，參數為新版本字串
 * @param intervalMs   輪詢間隔，預設 5 分鐘
 * @param doc          可注入的 document（監聽 visibilitychange）；測試可傳 null
 * @param timers       可注入的 setInterval／clearInterval 來源
 */
export function createUpdateChecker({ fetchVersion, onUpdate, intervalMs = 5 * 60_000, doc = globalThis.document, timers = globalThis } = {}) {
  /** 首次成功取得的版本；null 代表尚未建立基準。 */
  let baseline = null;
  /** 是否已通知過，避免橫幅重複出現。 */
  let notified = false;
  let timer = null;
  const normalize = (v) => String((v && typeof v === 'object' ? v.version : v) || '');

  /** 取一次版本並比對；回傳 true 表示這次觸發了通知。 */
  async function check() {
    let current;
    try { current = normalize(await fetchVersion()); } catch { return false; }
    if (!current) return false;
    if (baseline === null) { baseline = current; return false; }
    if (current !== baseline && !notified) { notified = true; onUpdate?.(current); return true; }
    return false;
  }

  /** 建立基準並開始定期檢查；分頁從背景切回時也立刻檢查一次（使用者最可能在這時拿到舊版）。 */
  async function start() {
    await check();
    timer = timers.setInterval?.(check, intervalMs);
    // Node 的 Timeout 可 unref，避免測試程序被計時器拖住；瀏覽器回傳數字則無此方法
    timer?.unref?.();
    doc?.addEventListener?.('visibilitychange', () => { if (doc.visibilityState === 'visible') check(); });
  }

  /** 停止定期檢查。 */
  function stop() { if (timer !== null) { timers.clearInterval?.(timer); timer = null; } }

  return { start, check, stop };
}
