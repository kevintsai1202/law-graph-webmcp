/** 建立共用的 3D 依賴載入器：大檔平行下載、每個腳本失敗或逾時自動重試一次，不阻擋首頁解析。 */
export function createGraphAssetLoader({ doc = globalThis.document, runtime = globalThis, timeoutMs = 15000, maxAttempts = 2 } = {}) {
  /** 同一批呼叫共用 Promise，避免多次重繪重複下載。 */
  let pending = null;
  /**
   * 兩條平行鏈：three → three-spritetext（spritetext 執行時就需要全域 THREE，9 KB 接在後面幾乎無感），
   * 與 3d-force-graph（自帶 three，不依賴全域）同時下載。
   * 不用 async=false 排序：被移除的停滯腳本仍占住「依序執行」佇列，會讓重試腳本永遠執行不到。
   */
  const chains = [
    [['THREE', '/vendor/three.min.js'], ['SpriteText', '/vendor/three-spritetext.min.js']],
    [['ForceGraph3D', '/vendor/3d-force-graph.min.js']]
  ];
  /** 插入一個 <script> 並等待其載入與全域物件建立；錯誤與逾時都清理節點。 */
  function attempt(name, src) {
    return new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      const timer = setTimeout(() => finish(new Error(`Loading timed out: ${src}`)), timeoutMs);
      /** 統一結束此次載入，避免保留事件與逾時計時器。 */
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      }
      script.src = src;
      script.onload = () => finish(runtime[name] ? null : new Error(`Missing graph dependency: ${name}`));
      script.onerror = () => finish(new Error(`Unable to load: ${src}`));
      doc.head.appendChild(script);
    });
  }
  /**
   * 載入單一腳本，失敗（含逾時）後重試至 maxAttempts 次。
   * 重試時在網址加上 retry 查詢字串，讓瀏覧器開新請求而不是沿用停滯中的連線（正式站曾在 HTTP/3 下卡住）。
   */
  async function load(name, src) {
    if (runtime[name]) return;
    for (let i = 1; ; i++) {
      try {
        return await attempt(name, i === 1 ? src : `${src}?retry=${i - 1}`);
      } catch (error) {
        if (i >= maxAttempts) throw error;
      }
    }
  }
  return () => {
    if (!pending) pending = Promise.all(chains.map(async (chain) => {
      for (const [name, src] of chain) await load(name, src);
    })).then(() => undefined).catch((error) => { pending = null; throw error; });
    return pending;
  };
}

/** 可能會用到關聯圖的畫面：案件已送出、正在跑或等待回答，以及結果頁本身。 */
const PRELOAD_VIEWS = new Set(['RUNNING', 'QUESTIONS', 'RESULT']);

/**
 * 是否該在此狀態下背景預載 3D 套件：案件送出後 LLM 要跑數分鐘，趁瀏覧器閒置先下載，
 * 結果出來時切關聯圖就零等待，也讓網路停滯的失敗有更多重試機會。
 */
export function shouldPreloadGraphAssets(state) {
  return Boolean(state?.caseId) && PRELOAD_VIEWS.has(state.view);
}
