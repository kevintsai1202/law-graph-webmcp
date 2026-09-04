// 用途：對線上（或本機）站台驗證 tw-legal-rag 語意檢索軌道端到端可用。
// 步驟：① 若尚未授權，自動走 OAuth start → provider authorize → callback（TLR 目前為自動同意，無需人工按鈕）
//       ② 以第一個 zh-TW 示範案例跑完整案件流程，WAITING 時以固定答案回覆
//       ③ 檢查 result.research.coverage.semanticStatus 是否為 SUCCESS，並列出 notes
// 需要目標站台已設定 LAWGRAPH_SEMANTIC_ENABLED=true 與真 OPENAI_API_KEY。
// 執行：node scripts/verify-semantic-live.mjs [baseUrl]   （預設 https://law-graph-webmcp.zeabur.app）
//       環境變數 TEST_MODEL 指定測試模型（預設 gpt-5.4-nano，省額度；設成空字串則用線上預設模型）
// 結束碼：0 = semantic SUCCESS；1 = 其他狀態或流程失敗。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = (process.argv[2] || 'https://law-graph-webmcp.zeabur.app').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 驗證一律用便宜的測試模型（後端只接受 LAWGRAPH_TEST_MODEL 這一個值，預設 gpt-5.4-nano）；TEST_MODEL= 空字串可改用線上預設模型
const TEST_MODEL = process.env.TEST_MODEL === undefined ? 'gpt-5.4-nano' : process.env.TEST_MODEL;
const json = (init) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(TEST_MODEL ? { 'X-LawGraph-Model': TEST_MODEL } : {}) },
  body: JSON.stringify(init)
});
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

// 可用 DOCS 指定要起草的書狀（逗號分隔，如 issues,preparatory,motion），MOTION 指定聲請事項
const DOCS = (process.env.DOCS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MOTION = process.env.MOTION || '';

/** 跑一個完整案件並回傳最終 CaseStatus。 */
async function runCase(caseText) {
  const startBody = { caseText, locale: 'zh-TW', ...(DOCS.length ? { documents: DOCS } : {}), ...(MOTION ? { motionRequest: MOTION } : {}) };
  let st = await (await fetch(`${base}/api/cases`, json(startBody))).json();
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
// 法條數與建圖結果：laws=0 會讓 GraphRules 剔除所有法條節點，圖只剩事實
const graph = finalStatus.result?.graph;
const graphNotes = finalStatus.result?.graph ? (finalStatus.result?.research?.notes || []).filter((n) => n.startsWith('removed')) : [];
console.log(`    laws=${finalStatus.result?.research?.laws?.length ?? 0} judgments=${finalStatus.result?.research?.judgments?.length ?? 0} graphNodes=${graph?.nodes?.length ?? 0} graphEdges=${graph?.edges?.length ?? 0} removed=${graphNotes.length}`);
// 書狀摘要：段落開頭、表格列數、是否殘留非台灣用語（與後端黑名單同步的抽樣）
const BANNED = ['合同', '訴訟請求', '人民法院', '證據材料', '雙方當事人', '損失賠償', '信息', '數據', '視頻'];
for (const doc of finalStatus.result?.documents || []) {
  const text = [doc.title, ...(doc.paragraphs || []), ...(doc.attachments || [])].join('\n');
  const banned = BANNED.filter((w) => text.includes(w));
  console.log(`[doc] ${doc.type} 《${doc.title}》 court=${doc.court} paragraphs=${(doc.paragraphs || []).length} issues=${(doc.issues || []).length} claims=${(doc.claimsBasis || []).length} undisputed=${(doc.undisputed || []).length} banned=${JSON.stringify(banned)}`);
  for (const p of (doc.paragraphs || []).slice(0, 4)) console.log('      ¶', p.slice(0, 90));
  for (const row of (doc.issues || []).slice(0, 2)) console.log('      爭點', row.no, row.issue, '|', (row.plaintiff || '').slice(0, 40), '|', (row.defendant || '').slice(0, 40), '|', row.basis);
}
if (finalStatus.status !== 'COMPLETED') {
  console.error('FAIL: 案件未完成', JSON.stringify(finalStatus.error));
  process.exit(1);
}
if (coverage?.semanticStatus !== 'SUCCESS') {
  console.error(`FAIL: semanticStatus=${coverage?.semanticStatus}`);
  process.exit(1);
}
console.log(`PASS: semantic=SUCCESS candidates=${coverage.semanticCandidateCount} merged=${coverage.mergedCount}`);
