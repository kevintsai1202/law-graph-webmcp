/** REST 封裝；fetchImpl 可注入以便測試。 */
export function createCaseClient(fetchImpl = globalThis.fetch, base = '') {
  /** 共用呼叫：JSON 進出；非 2xx 丟出帶 status／code 的 Error。 */
  async function call(path, init) {
    const res = await fetchImpl(base + path, { headers: { 'Content-Type': 'application/json' }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(body.message || String(res.status));
      e.status = res.status; e.code = body.error; throw e;
    }
    return body;
  }
  return {
    start: (caseText, locale) => call('/api/cases', { method: 'POST', body: JSON.stringify({ caseText, locale }) }),
    status: (id) => call(`/api/cases/${encodeURIComponent(id)}`),
    answer: (id, answers) => call(`/api/cases/${encodeURIComponent(id)}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }),
    samples: (locale) => call(`/api/samples?locale=${encodeURIComponent(locale)}`),
    verify: (ref) => call(`/api/laws/verify?ref=${encodeURIComponent(ref)}`),
    /** 每 intervalMs 輪詢一次；COMPLETED／FAILED 自動停；回傳 stop()。 */
    poll(id, onStatus, intervalMs = 2000) {
      let stopped = false; let timer = null;
      const tick = async () => {
        if (stopped) return;
        try {
          const s = await call(`/api/cases/${encodeURIComponent(id)}`);
          onStatus(s);
          if (s.status === 'COMPLETED' || s.status === 'FAILED') { stopped = true; return; }
        } catch (e) {
          onStatus({ status: 'FAILED', error: { code: e.code || 'NETWORK', message: e.message } });
          stopped = true; return;
        }
        timer = setTimeout(tick, intervalMs);
      };
      tick();
      return () => { stopped = true; clearTimeout(timer); };
    }
  };
}
