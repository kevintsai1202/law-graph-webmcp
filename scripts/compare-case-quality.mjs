// 用途：對同一個示範案例跑一次完整流程，把 CaseStatus 存到 eval/quality-<tag>.json，並印出品質與耗時指標，
//       供不同模型設定（例如 reasoning_effort 預設 vs low）逐項比對。
// 需要後端運行中（含 legal-mcp 與真 API 金鑰）；WAITING 時以固定答案回覆。
// 執行：node scripts/compare-case-quality.mjs <tag> [baseUrl] [sampleIndex]
//   例：node scripts/compare-case-quality.mjs default http://localhost:8090 0
//       node scripts/compare-case-quality.mjs low     http://localhost:8091 0
// 環境變數 TEST_MODEL 可帶 X-LawGraph-Model（預設不帶，用線上預設模型）。
import { mkdirSync, writeFileSync } from 'node:fs';

const tag = process.argv[2] || 'run';
const base = (process.argv[3] || 'http://localhost:8080').replace(/\/$/, '');
const sampleIndex = Number(process.argv[4] || 0);
const TEST_MODEL = process.env.TEST_MODEL || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(TEST_MODEL ? { 'X-LawGraph-Model': TEST_MODEL } : {}) },
  body: JSON.stringify(body)
});
/** WAITING 時的固定回答：刻意保守，兩組設定用同一句才有可比性。 */
const canned = '不確定／無資料，請以對我方最不利的情況假設。';

mkdirSync('eval', { recursive: true });
const samples = await (await fetch(`${base}/api/samples?locale=zh-TW`)).json();
const sample = samples[sampleIndex];
console.log(`[${tag}] 案例：${sample.title}（${sample.text.length} 字）@ ${base}`);

/** 記錄每個步驤第一次出現的時間，算出各階段耗時。 */
const stepAt = {};
const started = Date.now();
let st = await (await fetch(`${base}/api/cases`, json({ caseText: sample.text, locale: 'zh-TW' }))).json();
if (!st.caseId) throw new Error(`start failed: ${JSON.stringify(st)}`);
let rounds = 0;
while (!['COMPLETED', 'FAILED'].includes(st.status)) {
  await sleep(3000);
  st = await (await fetch(`${base}/api/cases/${st.caseId}`)).json();
  const key = `${st.status}:${st.step}`;
  if (!stepAt[key]) stepAt[key] = Math.round((Date.now() - started) / 1000);
  if (st.status === 'WAITING') {
    rounds += 1;
    const answers = st.questions.map((q) => ({ questionId: q.id, answer: canned }));
    st = await (await fetch(`${base}/api/cases/${st.caseId}/answers`, json({ answers }))).json();
  }
  if (Date.now() - started > 15 * 60 * 1000) throw new Error('case did not finish within 15 minutes');
}
const seconds = Math.round((Date.now() - started) / 1000);
writeFileSync(`eval/quality-${tag}.json`, JSON.stringify(st, null, 2));

const r = st.result || {};
const len = (v) => (Array.isArray(v) ? v.length : 0);
const text = (v) => (Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : '');
const elements = r.analysis?.elements || [];
const metCount = (k) => elements.filter((e) => e.met === k).length;
const usage = await (await fetch(`${base}/api/usage`)).json().catch(() => null);

/** 指標表：耗時、問答輪數、檢索量、涵攝、書狀、圖、驗證剔除。 */
const metrics = {
  tag, caseId: st.caseId, status: st.status, seconds, questionRounds: rounds, stepTimeline: stepAt,
  brainstorm: { facts: len(r.brainstorm?.facts), issues: len(r.brainstorm?.issues), relations: len(r.brainstorm?.relations), evidenceNeeds: len(r.brainstorm?.evidenceNeeds) },
  research: { laws: len(r.research?.laws), judgments: len(r.research?.judgments), notes: len(r.research?.notes), coverage: r.research?.coverage },
  analysis: { elements: elements.length, met: metCount('met'), unmet: metCount('unmet'), unclear: metCount('unclear'), strategyChars: text(r.analysis?.strategy).length, evidenceGaps: len(r.analysis?.evidenceGaps) },
  documents: (r.documents || []).map((d) => ({ type: d.type, paragraphs: len(d.paragraphs), chars: text(d.paragraphs).length, evidence: len(d.evidence) })),
  graph: { nodes: len(r.graph?.nodes), edges: len(r.graph?.edges), removedNotes: (r.research?.notes || []).filter((n) => /removed/i.test(n)).length },
  usageTodayTokens: usage?.usedTokens ?? null,
  error: st.error || null
};
console.log(JSON.stringify(metrics, null, 2));
