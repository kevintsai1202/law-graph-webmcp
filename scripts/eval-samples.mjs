// 用途：對四個示範案例各跑一次完整流程（兩語系），把 CaseStatus 存到 eval/，並統計硬規則剔除的節點／邊數。
// 需要後端運行中（含 legal-mcp 與真 OPENAI_API_KEY）；WAITING 時以固定答案回覆。
// 執行：node scripts/eval-samples.mjs [baseUrl]
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('eval', { recursive: true });

/** WAITING 時的固定回答：刻意保守，觀察模型在資訊不足時的處理。 */
const canned = { en: 'Unknown / not available. Please assume the worst case for our side.', 'zh-TW': '不確定／無資料，請以對我方最不利的情況假設。' };
const json = (init) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init) });
const rows = [];

for (const locale of ['en', 'zh-TW']) {
  const samples = await (await fetch(`${base}/api/samples?locale=${locale}`)).json();
  for (const s of samples) {
    const started = Date.now();
    let st = await (await fetch(`${base}/api/cases`, json({ caseText: s.text, locale }))).json();
    while (!['COMPLETED', 'FAILED'].includes(st.status)) {
      await sleep(3000);
      st = await (await fetch(`${base}/api/cases/${st.caseId}`)).json();
      if (st.status === 'WAITING') {
        const answers = st.questions.map((q) => ({ questionId: q.id, answer: canned[locale] }));
        st = await (await fetch(`${base}/api/cases/${st.caseId}/answers`, json({ answers }))).json();
      }
    }
    writeFileSync(`eval/${s.id}.${locale}.json`, JSON.stringify(st, null, 2));
    const notes = st.result?.research?.notes || [];
    rows.push({
      sample: s.id, locale, status: st.status, seconds: Math.round((Date.now() - started) / 1000),
      nodes: st.result?.graph?.nodes?.length ?? 0, edges: st.result?.graph?.edges?.length ?? 0,
      removedNodes: notes.filter((n) => n.startsWith('removed unverified')).length,
      removedEdges: notes.filter((n) => n.startsWith('removed edge')).length
    });
  }
}
console.table(rows);
writeFileSync('eval/summary.json', JSON.stringify(rows, null, 2));
