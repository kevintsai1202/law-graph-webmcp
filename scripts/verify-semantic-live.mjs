// 用途：對線上（或本機）站台驗證 tw-legal-rag 語意檢索軌道端到端可用。
// 步驟：① 若尚未授權，自動走 OAuth start → provider authorize → callback（TLR 目前為自動同意，無需人工按鈕）
//       ② 以第一個 zh-TW 示範案例跑完整案件流程，WAITING 時以固定答案回覆
//       ③ 檢查 result.research.coverage.semanticStatus 是否為 SUCCESS，並列出 notes
// 需要目標站台已設定 LAWGRAPH_SEMANTIC_ENABLED=true 與真 OPENAI_API_KEY。
// 執行：node scripts/verify-semantic-live.mjs [baseUrl]   （預設 https://law-graph-webmcp.zeabur.app）
// 結束碼：0 = semantic SUCCESS；1 = 其他狀態或流程失敗。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = (process.argv[2] || 'https://law-graph-webmcp.zeabur.app').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (init) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init) });
/** WAITING 時的固定回答：刻意保守，讓流程不停在人工提問。 */
const canned = '不確定／無資料，請以對我方最不利的情況假設。';
mkdirSync('logs', { recursive: true });

/** 讀取授權狀態端點。 */
async function authStatus() {
  return (await fetch(`${base}/api/auth/tw-legal-rag/status`)).json();
}

/** 手動跟隨轉址鏈：start → provider authorize → callback；回傳 callback 的最終 Location。 */
async function authorize() {
  let url = `${base}/api/auth/tw-legal-rag/start?returnTo=%2F`;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, { redirect: 'manual' });
    const location = res.headers.get('location');
    console.log(`  hop${hop} ${res.status} ${new URL(url).host}${new URL(url).pathname} -> ${location ? new URL(location, url).host + new URL(location, url).pathname : '(none)'}`);
    if (!location) return url;
    url = new URL(location, url).toString();
    // 到達本站 callback 之後的下一跳就是首頁，不必再跟
    if (new URL(url).pathname === '/' || new URL(url).searchParams.has('mcpAuth')) {
      return url;
    }
  }
  return url;
}

/** 跑一個完整案件並回傳最終 CaseStatus。 */
async function runCase(caseText) {
  let st = await (await fetch(`${base}/api/cases`, json({ caseText, locale: 'zh-TW' }))).json();
  if (!st.caseId) throw new Error(`start failed: ${JSON.stringify(st)}`);
  console.log(`  caseId=${st.caseId}`);
  const started = Date.now();
  while (!['COMPLETED', 'FAILED'].includes(st.status)) {
    await sleep(4000);
    st = await (await fetch(`${base}/api/cases/${st.caseId}`)).json();
    if (st.status === 'WAITING') {
      const answers = st.questions.map((q) => ({ questionId: q.id, answer: canned }));
      st = await (await fetch(`${base}/api/cases/${st.caseId}/answers`, json({ answers }))).json();
    }
    if (Date.now() - started > 10 * 60 * 1000) throw new Error('case did not finish within 10 minutes');
  }
  console.log(`  status=${st.status} step=${st.step} seconds=${Math.round((Date.now() - started) / 1000)}`);
  return st;
}

console.log(`[1] 授權狀態 @ ${base}`);
let status = await authStatus();
console.log('  ', JSON.stringify(status));
if (status.enabled && !status.authorized) {
  console.log('[1a] 尚未授權，自動走 OAuth 轉址鏈');
  const finalUrl = await authorize();
  console.log(`  final=${finalUrl}`);
  status = await authStatus();
  console.log('  ', JSON.stringify(status));
}
if (!status.authorized) {
  console.error('FAIL: 無法完成授權');
  process.exit(1);
}

// 可用 CASE_TEXT_FILE 指定自訂案情檔（例如 >500 字的長案情，用來驗證 condenseSemanticQuery 路徑）；未指定則用第一個 zh-TW 示範案例
let caseText;
if (process.env.CASE_TEXT_FILE) {
  caseText = readFileSync(process.env.CASE_TEXT_FILE, 'utf8').trim();
  console.log(`[2] 跑自訂案情 ${process.env.CASE_TEXT_FILE}（${caseText.length} 字）`);
} else {
  console.log('[2] 跑一個 zh-TW 示範案例');
  const samples = await (await fetch(`${base}/api/samples?locale=zh-TW`)).json();
  caseText = samples[0].text;
}
const finalStatus = await runCase(caseText);
writeFileSync(`logs/verify-semantic-live-${Date.now()}.json`, JSON.stringify(finalStatus, null, 2));

const coverage = finalStatus.result?.research?.coverage;
const notes = finalStatus.result?.research?.notes || [];
console.log('[3] coverage =', JSON.stringify(coverage));
console.log('    notes    =', JSON.stringify(notes.filter((n) => /track|semantic/i.test(n))));
if (finalStatus.status !== 'COMPLETED') {
  console.error('FAIL: 案件未完成', JSON.stringify(finalStatus.error));
  process.exit(1);
}
if (coverage?.semanticStatus !== 'SUCCESS') {
  console.error(`FAIL: semanticStatus=${coverage?.semanticStatus}`);
  process.exit(1);
}
console.log(`PASS: semantic=SUCCESS candidates=${coverage.semanticCandidateCount} merged=${coverage.mergedCount}`);
