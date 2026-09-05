/** 建立共用的 3D 依賴載入器；保持載入順序，失敗可重試，不阻擋首頁解析。 */
export function createGraphAssetLoader({ doc = globalThis.document, runtime = globalThis, timeoutMs = 15000 } = {}) {
  /** 同一批呼叫共用 Promise，避免多次重繪重複下載。 */
  let pending = null;
  const assets = [['THREE', '/vendor/three.min.js'], ['SpriteText', '/vendor/three-spritetext.min.js'], ['ForceGraph3D', '/vendor/3d-force-graph.min.js']];
  /** 等待單一腳本載入與全域物件建立；錯誤與逾時都清理節點。 */
  function load(name, src) {
    if (runtime[name]) return Promise.resolve();
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
  return () => {
    if (!pending) pending = (async () => {
      for (const [name, src] of assets) await load(name, src);
    })().catch((error) => { pending = null; throw error; });
    return pending;
  };
}
