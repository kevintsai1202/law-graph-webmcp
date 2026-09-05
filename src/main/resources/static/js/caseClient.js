/** REST 封裝；fetchImpl 可注入以便測試。 */
export function createCaseClient(fetchImpl = globalThis.fetch, base = '', { entryTimeoutMs = 8000 } = {}) {
  /** 共用呼叫：JSON 或 FormData 進、JSON 出；非 2xx 丟出帶 status／code 的 Error。 */
  async function call(path, init) {
    const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const res = await fetchImpl(base + path, { ...(!isForm && { headers: { 'Content-Type': 'application/json' } }), ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(body.message || String(res.status));
      e.status = res.status; e.code = body.error; throw e;
    }
    return body;
  }
  /** 入口唯讀查詢設逾時；不套用到耗時分析與案件提交，避免誤判提交結果。 */
  function entry(path) {
    return call(path, { signal: AbortSignal.timeout(entryTimeoutMs) });
  }
  return {
    /** 有附件時改用 multipart；無附件維持既有 JSON 契約與 WebMCP 相容性。 */
    start: (caseText, locale, documents, files = [], motionRequest = '') => {
      if (Array.isArray(files) && files.length) {
        const form = new FormData();
        form.append('caseText', caseText || '');
        form.append('locale', locale);
        if (motionRequest) form.append('motionRequest', motionRequest);
        (Array.isArray(documents) ? documents : []).forEach((document) => form.append('documents', document));
        files.forEach((file) => form.append('files', file, file.name));
        return call('/api/cases', { method: 'POST', body: form });
      }
      return call('/api/cases', {
        method: 'POST',
        body: JSON.stringify({
          caseText, locale,
          ...(Array.isArray(documents) && documents.length ? { documents } : {}),
          ...(motionRequest ? { motionRequest } : {})
        })
      });
    },
    status: (id) => call(`/api/cases/${encodeURIComponent(id)}`),
    answer: (id, answers) => call(`/api/cases/${encodeURIComponent(id)}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }),
    samples: (locale) => entry(`/api/samples?locale=${encodeURIComponent(locale)}`),
    verify: (ref) => call(`/api/laws/verify?ref=${encodeURIComponent(ref)}`),
    authStatus: () => entry('/api/auth/tw-legal-rag/status'),
    /** 今日 token 用量與是否停用。 */
    usage: () => entry('/api/usage'),
    /** 呼叫端今日案件配額（已用／上限／剩餘）。 */
    quota: () => entry('/api/quota'),
    /** 目前登入者（Google）；未登入 loggedIn=false。 */
    me: () => entry('/api/me'),
    /** 登出：Spring Security 的 POST /logout 會 302 回首頁，這裡只需送出請求。 */
    logout: () => fetchImpl(base + '/logout', { method: 'POST', redirect: 'manual' }),
    /**
     * 每 intervalMs 輪詢一次；COMPLETED／FAILED／WAITING 自動停（WAITING 由人工回答後以 answer 續接）；回傳 stop()。
     * 短暫的 5xx／網路錯誤（例如部署換容器的一分鐘）不立刻判失敗：改以 failureIntervalMs 重試，
     * 連續失敗達 maxFailures 才回 FAILED／NETWORK；404（案件不存在）則立即失敗。
     */
    poll(id, onStatus, intervalMs = 2000, { maxFailures = 3, failureIntervalMs = 10000 } = {}) {
      let stopped = false; let timer = null; let failures = 0;
      const tick = async () => {
        if (stopped) return;
        try {
          const s = await call(`/api/cases/${encodeURIComponent(id)}`);
          failures = 0;
          onStatus(s);
          if (s.status === 'COMPLETED' || s.status === 'FAILED' || s.status === 'WAITING') { stopped = true; return; }
        } catch (e) {
          failures += 1;
          if (e.status !== 404 && failures < maxFailures) { timer = setTimeout(tick, failureIntervalMs); return; }
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
