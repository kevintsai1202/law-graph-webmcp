import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/main/resources/static/js/views/util.js';
import { bindInput, renderInput } from '../src/main/resources/static/js/views/input.js';
import { renderProgress, renderCancel, STEPS, STEPS_BY_MODE } from '../src/main/resources/static/js/views/progress.js';
import { renderHome, bindHome } from '../src/main/resources/static/js/views/home.js';
import { renderQuestions } from '../src/main/resources/static/js/views/questions.js';
import { renderResult, renderSections, claimStatus, checklistCsv, findingsCsv, tabsFor } from '../src/main/resources/static/js/views/result.js';

test('renderSections 只列出已有的中間成果段落，且文字經轉義', () => {
  const partial = { brainstorm: { facts: ['<i>hit</i>'], relations: [], issues: ['Negligence'], evidenceNeeds: [] } };
  const html = renderSections(partial, 'en');
  assert.match(html, /data-section="brainstorm"/);
  assert.doesNotMatch(html, /data-section="research"/);
  assert.match(html, /&lt;i&gt;hit&lt;\/i&gt;/);
  assert.match(html, /Results so far/);
  assert.equal(renderSections(null, 'en'), '');
});

// 用途：view 的 render 皆為「model → HTML 字串」純函式，在 node 驗證結構與轉義。
test('esc 轉義五個危險字元', () => {
  assert.equal(esc(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('input 列出示範案例卡片並含 data-sample-id', () => {
  const html = renderInput({ samples: [{ id: 'car-accident', title: 'Car', summary: 's' }] }, 'en');
  assert.match(html, /data-sample-id="car-accident"/);
  assert.match(html, /Analyse/);
});
test('input 提供 PDF、Markdown、DOCX 多檔上傳與限制說明', () => {
  const html = renderInput({ samples: [] }, 'zh-TW');
  assert.match(html, /id="case-files"[^>]*accept="\.pdf,\.md,\.markdown,\.docx"[^>]*multiple/);
  assert.match(html, /id="file-dropzone"/);
  assert.match(html, /將參考文件拖曳到這裡/);
  assert.match(html, /id="file-list"[^>]*role="list"/);
  assert.match(html, /最多 5 份/);
  assert.match(html, /掃描型 PDF 會由視覺模型轉錄，結果需人工核對/);
});

test('input 在語意檢索未授權時顯示提示與授權入口', () => {
  const html = renderInput({
    samples: [],
    semanticAuth: { enabled: true, authorized: false, startPath: '/api/auth/tw-legal-rag/start?returnTo=%2F' }
  }, 'zh-TW');
  assert.match(html, /語意檢索：未授權/);
  assert.match(html, /完成授權後，本次分析才會納入判決語意檢索/);
  assert.match(html, /href="\/api\/auth\/tw-legal-rag\/start\?returnTo=%2F"/);
});

test('input 綁定時使用目前語系，初始化完成後分析按鈕可送出', () => {
  /** 建立最小 DOM 節點替身，驗證初始化不會在 click 綁定前中斷。 */
  const node = (extra = {}) => ({
    listeners: new Map(),
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    ...extra
  });
  const textarea = node({ value: '' });
  const files = node({ files: [], value: '', click() {} });
  const submit = node({ disabled: true });
  const count = node({ textContent: '' });
  const fileStatus = node({ textContent: '' });
  const dropzone = node();
  const fileList = node({ replaceChildren() {} });
  const output = node({ checked: true, value: 'graph' });
  const bySelector = {
    '#case-text': textarea,
    '#case-files': files,
    '#case-submit': submit,
    '#case-count': count,
    '#file-status': fileStatus,
    '#file-dropzone': dropzone,
    '#file-list': fileList
  };
  const root = {
    querySelector: (selector) => bySelector[selector],
    querySelectorAll: (selector) => selector.includes('outputs') ? [output] : []
  };
  let submittedText = null;

  bindInput(root, { onSubmit: (text) => { submittedText = text; }, onSample() {} }, 'zh-TW');
  assert.equal(fileStatus.textContent, '尚未選擇檔案。');
  assert.ok(submit.listeners.has('click'), '初始化後必須完成 click 事件綁定');

  textarea.value = '這是一段已達最低字數且可以送出的案件內容。';
  textarea.listeners.get('input')();
  assert.equal(submit.disabled, false);
  submit.listeners.get('click')();
  assert.equal(submittedText, textarea.value);
});
test('input 有聲請事項欄位，預設隱藏；標題與 placeholder 依語系', () => {
  const html = renderInput({ samples: [] }, 'zh-TW');
  assert.match(html, /<div class="motion-field" id="motion-field" hidden>/);
  assert.match(html, /id="motion-request"/);
  assert.match(html, /聲請事項（要請法院准許什麼）/);
  assert.match(renderInput({ samples: [] }, 'en'), /Motion request/);
});
test('input 今日額度用完時顯示提示與 Law Powers 連結；未用完不顯示', () => {
  const exhausted = renderInput({ samples: [], usage: { exhausted: true, paused: true } }, 'zh-TW');
  assert.match(exhausted, /今日 AI 額度已用完/);
  assert.match(exhausted, /href="https:\/\/kevintsai1202\.github\.io\/law-powers\/"/);
  assert.match(exhausted, /取得 Law Powers/);
  const fine = renderInput({ samples: [], usage: { exhausted: false } }, 'zh-TW');
  assert.doesNotMatch(fine, /今日 AI 額度已用完/);
  assert.doesNotMatch(fine, /usage-banner/);
  // 側欄常駐說明：不論額度狀態都要有 Law Powers 連結
  assert.match(fine, /lawpowers-note/);
  assert.match(fine, /Law Powers 技能/);
  assert.match(renderInput({ samples: [] }, 'en'), /lawpowers-note[\s\S]*Law Powers skills/);
});
test('input 已附參考文件時不強制 20 字：短描述可送出，提示改為附檔說明，計數不再顯示 / 20', () => {
  const node = (extra = {}) => ({
    listeners: new Map(),
    classes: new Set(),
    classList: {
      toggle(name, force) { if (force) this.owner.classes.add(name); else this.owner.classes.delete(name); },
      add() {}, remove() {}
    },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    ...extra
  });
  const own = (n) => { n.classList.owner = n; return n; };
  const textarea = own(node({ value: 'e' }));
  const files = own(node({ files: [], value: '', click() {} }));
  const submit = own(node({ disabled: true }));
  const count = own(node({ textContent: '' }));
  const hintText = own(node({ textContent: '' }));
  const fileStatus = own(node({ textContent: '' }));
  const dropzone = own(node());
  /** 最小 document 替身：renderFileList 以 createElement 建立檔案卡片，這裡只需可鏈式操作的空物件。 */
  const fakeDoc = { createElement: () => ({ dataset: {}, classList: { add() {} }, setAttribute() {}, append() {}, set innerHTML(v) {} }) };
  const fileList = own(node({ replaceChildren() {}, append() {}, ownerDocument: fakeDoc }));
  const output = own(node({ checked: true, value: 'graph' }));
  const bySelector = {
    '#case-text': textarea, '#case-files': files, '#case-submit': submit, '#case-count': count,
    '#case-hint-text': hintText, '#file-status': fileStatus, '#file-dropzone': dropzone, '#file-list': fileList
  };
  const root = {
    querySelector: (selector) => bySelector[selector],
    querySelectorAll: (selector) => selector.includes('outputs') ? [output] : []
  };
  bindInput(root, { onSubmit() {}, onSample() {} }, 'zh-TW');

  // 未附檔：1 字不足 20，送出停用，提示為原本的最低字數說明
  assert.equal(submit.disabled, true);
  assert.equal(count.textContent, '1 / 20');
  assert.equal(hintText.textContent, '至少 20 字。事實越具體，分析越精準。');

  // 附上一份檔案後：送出啟用、提示改為附檔說明、計數不再帶 / 20 且標記 ok
  files.files = [{ name: 'contract.pdf', size: 1024 }];
  files.listeners.get('change')();
  assert.equal(submit.disabled, false);
  assert.equal(hintText.textContent, '已附參考文件，描述可留空或簡述即可。');
  assert.equal(count.textContent, '1');
  assert.ok(count.classes.has('ok'));

  // 移除檔案後回到原本規則
  files.files = [];
  files.listeners.get('change')();
  assert.equal(submit.disabled, true);
  assert.equal(count.textContent, '1 / 20');
  assert.equal(hintText.textContent, '至少 20 字。事實越具體，分析越精準。');
});
test('bindInput 勾選聲請狀時顯示聲請事項欄位，送出時把內容作為第四個參數傳出', () => {
  const node = (extra = {}) => ({ listeners: new Map(), classList: { toggle() {}, add() {}, remove() {} }, addEventListener(type, l) { this.listeners.set(type, l); }, ...extra });
  const textarea = node({ value: '這是一段已達最低字數且可以送出的案件內容。' });
  const files = node({ files: [], value: '', click() {} });
  const submit = node({ disabled: true });
  const count = node({ textContent: '' });
  const motionField = node({ hidden: true });
  const motionInput = node({ value: '  聲請調查證據  ' });
  const graph = node({ checked: true, value: 'graph' });
  const motion = node({ checked: false, value: 'motion' });
  const bySelector = { '#case-text': textarea, '#case-files': files, '#case-submit': submit, '#case-count': count,
    '#file-status': node({ textContent: '' }), '#file-dropzone': node(), '#file-list': node({ replaceChildren() {} }),
    '#motion-field': motionField, '#motion-request': motionInput };
  const root = { querySelector: (s) => bySelector[s] ?? null,
    querySelectorAll: (s) => s.includes(':checked') ? [graph, motion].filter((c) => c.checked) : s.includes('outputs') ? [graph, motion] : [] };
  let submitted = null;
  bindInput(root, { onSubmit: (...args) => { submitted = args; }, onSample() {} }, 'zh-TW');
  assert.equal(motionField.hidden, true, '未勾選聲請狀時隱藏');
  motion.checked = true;
  motion.listeners.get('change')();
  assert.equal(motionField.hidden, false, '勾選聲請狀後顯示');
  submit.listeners.get('click')();
  assert.deepEqual(submitted.slice(1), [['graph', 'motion'], [], '聲請調查證據', {}]);
});
test('progress 高亮當前步驤且之前步驤標 done', () => {
  const html = renderProgress({ step: 'RESEARCH' }, 'zh-TW');
  assert.match(html, /class="step done"[^>]*data-step="BRAINSTORM"/);
  assert.match(html, /class="step active"[^>]*data-step="RESEARCH"/);
  assert.match(html, /找法條與判決（請求權基礎與實務見解檢索）/);
});
test('進度條七步，第五步為抗辯評估與舉證責任，用語為訴訟實務用語', () => {
  assert.deepEqual(STEPS, ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'ASSESSMENT', 'DOCUMENTS', 'GRAPH']);
  const html = renderProgress({ step: 'ASSESSMENT' }, 'zh-TW');
  // 白話為主、括號附專業名詞
  assert.match(html, /對方會怎麼反駁、誰要負責證明（抗辯評估與舉證責任）/);
  assert.match(html, /逐條檢查是否符合法律要件（構成要件涵攝）/);
  assert.match(html, /找法條與判決（請求權基礎與實務見解檢索）/);
  assert.match(renderProgress({ step: 'ASSESSMENT' }, 'en'), /Defenses &amp; burden of proof/);
});
test('進行中／等待回答時提供取消按鈕，可退回輸入頁', () => {
  const html = renderCancel('zh-TW');
  assert.match(html, /id="cancel-case"/);
  assert.match(html, /放棄此案/);
  assert.match(renderCancel('en'), /Cancel/);
});
test('questions 每題一個 textarea，name 為 questionId', () => {
  const html = renderQuestions({ questions: [{ id: 'q1', text: 'Dashcam?', why: 'causation' }], answers: { q1: 'Yes.' }, notice: 'Agent filled 1 visible question field(s).' }, 'en');
  assert.match(html, /<textarea[^>]*name="q1"/);
  assert.match(html, />Yes\.<\/textarea>/);
  assert.match(html, /causation/);
  assert.match(html, /id="question-fill-notice"/);
});
test('result 含四個分頁與 network-canvas，模型文字經轉義', () => {
  const status = { locale: 'en', result: {
    brainstorm: { facts: ['<b>x</b>'], relations: [], issues: [], evidenceNeeds: [], questions: [] },
    research: { laws: [], judgments: [], notes: ['removed edge: a->b (x)'] },
    analysis: { elements: [], strategy: '', evidenceGaps: [], disclaimer: '' },
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status }, 'en');
  assert.match(html, /id="network-canvas"/);
  assert.match(html, /data-tab="analysis"/);
  assert.match(html, /removed edge: a-&gt;b \(x\)/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});
test('result 缺少任一段落時不會拋錯', () => {
  const html = renderResult({ status: { locale: 'zh-TW', result: { graph: { nodes: [], edges: [] } } } }, 'zh-TW');
  assert.match(html, /關係圖/);
});

// ── 輸出項目勾選與書狀分頁 ──
test('input 有輸出項目勾選區：關聯圖預設勾選、八種書狀未勾選', () => {
  const html = renderInput({ samples: [] }, 'zh-TW');
  assert.match(html, /name="outputs" value="graph"[^>]*checked/);
  assert.match(html, /name="outputs" value="complaint"(?![^>]*checked)/);
  assert.match(html, /name="outputs" value="motion"/);
  assert.match(html, /關聯圖/);
  assert.match(html, /起訴狀/);
  assert.match(html, /爭點整理/);
});
test('progress 在 ANALYSIS 與 GRAPH 之間有 DOCUMENTS 步驟', () => {
  const html = renderProgress({ step: 'DOCUMENTS' }, 'zh-TW');
  assert.match(html, /class="step done"[^>]*data-step="ANALYSIS"/);
  assert.match(html, /class="step active"[^>]*data-step="DOCUMENTS"/);
  assert.match(html, /class="step"[^>]*data-step="GRAPH"/);
});
test('result 依 outputs 產生書狀分頁並以公文書狀版面呈現，未勾關聯圖則無圖分頁', () => {
  const status = { locale: 'zh-TW', result: {
    documents: [{ type: 'complaint', title: '民事起訴狀', court: '臺灣臺北地方法院',
      parties: [{ role: '原告', name: '<甲>' }], paragraphs: ['一、緣被告駕車…'],
      attachments: ['證一：行車紀錄器'], date: '中華民國115年9月1日' }],
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['complaint'] }, 'zh-TW');
  assert.match(html, /data-tab="doc-complaint"/);
  assert.doesNotMatch(html, /data-tab="graph"/);
  assert.doesNotMatch(html, /id="network-canvas"/);
  assert.match(html, /class="legal-doc"/);
  assert.match(html, /民事起訴狀/);
  assert.match(html, /&lt;甲&gt;/);
  assert.match(html, /此致/);
  assert.match(html, /證一：行車紀錄器/);
  assert.match(html, /中華民國115年9月1日/);
});
test('爭點整理依司法院官方三表呈現：不爭執事項、聲明與請求權基礎、爭點整理表（八欄），內容轉義並各附 CSV', () => {
  const status = { locale: 'zh-TW', result: {
    documents: [{ type: 'issues', title: '爭點整理', court: '臺灣臺北地方法院',
      parties: [{ role: '原告', name: '甲' }], paragraphs: ['本件爭點整理如下：'],
      undisputed: [{ no: '1', fact: '兩造於○年簽約', evidence: '甲證1–契約書' }],
      claimsBasis: [{ no: '1', basis: '民法第184條第1項前段', claim: '被告應給付原告○萬元' }],
      issues: [
        { no: '1', issue: '被告是否有過失？', plaintiff: '被告未保持安全距離', plaintiffEvidence: '甲證3–行車紀錄器',
          defendant: '<原告>突然變換車道', defendantEvidence: '乙證1–證人證述', basis: '民法第184條第1項前段' },
        { no: '2', issue: '損害額若干？', plaintiff: '修車費 5 萬', plaintiffEvidence: '甲證4–估價單', defendant: '應扣折舊', defendantEvidence: '', basis: '民法第196條' }
      ], attachments: [], date: '' }],
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['issues'] }, 'zh-TW');
  assert.match(html, /<table class="issue-table issue-table"/);
  for (const head of ['序次', '爭點', '原告主張', '原告證據', '被告抗辯', '被告證據', '法律依據']) {
    assert.match(html, new RegExp(`<th[^>]*>${head}</th>`), head);
  }
  assert.match(html, /不爭執事項清單/);
  assert.match(html, /<th[^>]*>兩造不爭執事實<\/th>/);
  assert.match(html, /聲明與請求權基礎清單/);
  assert.match(html, /<th[^>]*>請求權基礎<\/th>/);
  assert.match(html, /被告未保持安全距離/);
  assert.match(html, /&lt;原告&gt;突然變換車道/);
  assert.match(html, /download="爭點整理表\.csv"/);
  assert.match(html, /download="不爭執事項清單\.csv"/);
  assert.match(html, /download="聲明與請求權基礎清單\.csv"/);
  assert.match(html, new RegExp(encodeURIComponent('民法第196條')));
  // 表格順序：不爭執 → 聲明與請求權基礎 → 爭點整理表
  assert.ok(html.indexOf('不爭執事項清單') < html.indexOf('聲明與請求權基礎清單') && html.indexOf('聲明與請求權基礎清單') < html.indexOf('爭點整理表'));
});
test('準備書狀附聲明與請求權基礎清單與爭點整理表，一般書狀無表格', () => {
  const doc = (type, extra = {}) => ({ type, title: 't', court: '', parties: [], paragraphs: ['一、'], attachments: [], date: '', ...extra });
  const prep = renderResult({ status: { locale: 'zh-TW', result: { documents: [doc('preparatory', {
    claimsBasis: [{ no: '1', basis: '民法第184條第1項前段', claim: '被告應給付' }],
    issues: [{ no: '1', issue: '是否有過失？', plaintiff: 'p', plaintiffEvidence: '', defendant: 'd', defendantEvidence: '', basis: '' }] })],
    graph: { nodes: [], edges: [] } } }, outputs: ['preparatory'] }, 'zh-TW');
  assert.match(prep, /聲明與請求權基礎清單/);
  assert.match(prep, /爭點整理表/);
  assert.doesNotMatch(prep, /不爭執事項清單/);
  const complaint = renderResult({ status: { locale: 'zh-TW', result: { documents: [doc('complaint')], graph: { nodes: [], edges: [] } } }, outputs: ['complaint'] }, 'zh-TW');
  assert.doesNotMatch(complaint, /issue-table/);
});
test('爭點整理沒有表格列時退回段落版面，不拋錯', () => {
  const status = { locale: 'zh-TW', result: {
    documents: [{ type: 'issues', title: '爭點整理', court: '', parties: [], paragraphs: ['一、爭點甲'], attachments: [], date: '' }],
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['issues'] }, 'zh-TW');
  assert.doesNotMatch(html, /issue-table/);
  assert.match(html, /一、爭點甲/);
});
test('result 勾選書狀但後端沒回該書狀時顯示未產生提示，不拋錯', () => {
  const status = { locale: 'zh-TW', result: { graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['graph', 'defense'] }, 'zh-TW');
  assert.match(html, /data-tab="graph"/);
  assert.match(html, /data-tab="doc-defense"/);
  assert.match(html, /doc-missing/);
});
test('result 未給 outputs 時維持既有預設（關聯圖＋三個輔助分頁）', () => {
  const status = { locale: 'en', result: { graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status }, 'en');
  assert.match(html, /data-tab="graph"/);
  assert.match(html, /data-tab="analysis"/);
});

// ── ui-ux-pro-max 強化後的語意與可及性標記 ──
test('input 有可見 label、字數提示，送出鈕初始停用', () => {
  const html = renderInput({ samples: [] }, 'zh-TW');
  assert.match(html, /<label class="field-label" for="case-text">描述你的爭議<\/label>/);
  assert.match(html, /aria-describedby="case-hint"/);
  assert.match(html, /id="case-submit"[^>]*disabled/);
  assert.match(html, /0 \/ 20/);
});
test('progress 當前步驤帶 aria-current 與序號；busy=false 時不帶 data-busy', () => {
  const busy = renderProgress({ step: 'RESEARCH' }, 'en');
  assert.match(busy, /class="step active" data-step="RESEARCH" aria-current="step" data-busy/);
  assert.match(busy, /<span class="step-no" aria-hidden="true">3<\/span>/);
  const idle = renderProgress({ step: 'QUESTIONS', busy: false }, 'en');
  assert.match(idle, /aria-current="step"/);
  assert.doesNotMatch(idle, /data-busy/);
});
test('result 分頁具 tablist／tab／tabpanel 語意且 aria-selected 對應 activeTab', () => {
  const status = { locale: 'en', result: { graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, activeTab: 'analysis' }, 'en');
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="tab-analysis"[^>]*aria-selected="true"/);
  assert.match(html, /id="tab-graph"[^>]*aria-selected="false"/);
  assert.match(html, /role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis"/);
  assert.match(html, /id="close-panel-btn"[^>]*aria-label="Close detail panel"/);
});
test('analysis 要件列依 met 產生三色類別，符號＋文字雙重編碼且經轉義', () => {
  const status = { locale: 'zh-TW', result: { analysis: {
    elements: [{ law: '民法第184條', element: '<過失>', met: 'yes', basis: 'b1' }, { law: 'L', element: 'E', met: 'no', basis: 'b2' }, { law: 'L', element: 'E', met: 'maybe', basis: 'b3' }],
    strategy: '', evidenceGaps: [], disclaimer: '' } } };
  const html = renderResult({ status, activeTab: 'analysis' }, 'zh-TW');
  assert.match(html, /class="el el-yes"><span class="el-badge">○ 該當<\/span>/);
  assert.match(html, /class="el el-no"><span class="el-badge">✗ 不該當<\/span>/);
  assert.match(html, /class="el el-unknown"><span class="el-badge">△ 事實不明/);
  assert.match(html, /&lt;過失&gt;/);
});

test('research 顯示雙軌 coverage 與來源，且仍相容只有舊 judgments 欄位的結果', () => {
  const status = { locale: 'zh-TW', result: { research: {
    laws: [],
    judgments: [{ jid: 'J1', citation: '最高法院判決' }],
    notes: [],
    coverage: { keywordStatus: 'SUCCESS', semanticStatus: 'UNAVAILABLE', mergedCount: 1 },
    evidence: [{ judgment: { jid: 'J1' }, sources: ['KEYWORD'], fullTextVerified: false }]
  } } };
  const html = renderResult({ status, activeTab: 'research' }, 'zh-TW');
  assert.match(html, /檢索涵蓋狀態/);
  assert.match(html, /semantic=UNAVAILABLE/);
  assert.match(html, /最高法院判決 \[KEYWORD\]/);
});
test('input 顯示今日案件配額次數與限制原因；用完時顯示用完提示', () => {
  const fine = renderInput({ samples: [], quota: { used: 1, limit: 3, remaining: 2, exhausted: false } }, 'zh-TW');
  assert.match(fine, /quota-note/);
  assert.match(fine, /1 \/ 3/);
  assert.match(fine, /免費/);
  assert.doesNotMatch(fine, /quota-banner/);
  const gone = renderInput({ samples: [], quota: { used: 3, limit: 3, remaining: 0, exhausted: true } }, 'zh-TW');
  assert.match(gone, /quota-banner/);
  assert.match(gone, /今日 3 次分析已用完/);
  const en = renderInput({ samples: [], quota: { used: 0, limit: 3, remaining: 3, exhausted: false } }, 'en');
  assert.match(en, /0 \/ 3/);
  assert.match(en, /free/);
  // 沒有配額資料（例如後端不限制）時不顯示
  assert.doesNotMatch(renderInput({ samples: [] }, 'zh-TW'), /quota-note/);
});

test('input 匿名且登入可提高上限時，配額說明附 Google 登入提示；已登入不顯示', () => {
  const anon = renderInput({ samples: [], quota: { used: 0, limit: 1, remaining: 1, exhausted: false, loggedIn: false, memberLimit: 5, loginPath: '/oauth2/authorization/google' } }, 'zh-TW');
  assert.match(anon, /quota-login[^>]*href="\/oauth2\/authorization\/google"/);
  assert.match(anon, /每天可分析 5 次/);
  const member = renderInput({ samples: [], quota: { used: 2, limit: 5, remaining: 3, exhausted: false, loggedIn: true, memberLimit: 5 } }, 'zh-TW');
  assert.doesNotMatch(member, /quota-login/);
  assert.match(member, /2 \/ 5/);
});

test('涵攝與評估分頁：請求權小結、對造抗辯表、證據舉證表、風險摘要', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    brainstorm: { facts: [], relations: [], issues: [], evidenceNeeds: [] },
    research: { laws: [], judgments: [], notes: [] },
    analysis: { elements: [
      { law: '民法第184條第1項', element: '故意或過失', met: 'yes', basis: 'b', fact: 'f' },
      { law: '民法第184條第1項', element: '損害', met: 'unknown', basis: 'b', fact: 'f' },
      { law: '民法第197條第1項', element: '二年時效', met: 'no', basis: 'b', fact: 'f' }
    ], strategy: '先補證據', evidenceGaps: ['醫療單據'], disclaimer: '' },
    assessment: {
      defenses: [{ issue: '時效', defense: '已罹於時效', response: '自知悉起算未滿二年', risk: 'high' }],
      evidencePlan: [{ fact: '知悉時點', burden: '被告', available: '無', missing: '送達證明', howToObtain: '函查郵局' }],
      riskSummary: '整體中等風險'
    },
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, activeTab: 'analysis', outputs: ['graph'] }, 'zh-TW');
  assert.match(html, /各項請求能不能成立（請求權基礎小結）/);
  assert.match(html, /民法第184條第1項[^<]*<[^>]*>[^<]*待補證據/);
  assert.match(html, /民法第197條第1項[^<]*<[^>]*>[^<]*有要件不該當/);
  assert.match(html, /對方可能怎麼反駁、我們怎麼回應（抗辯評估）/);
  assert.match(html, /已罹於時效/);
  assert.match(html, /risk-high/);
  assert.match(html, /誰要證明什麼、還缺哪些證據（舉證責任與證據計畫）/);
  assert.match(html, /函查郵局/);
  assert.match(html, /整體風險[\s\S]*整體中等風險/);
});

test('claimStatus 依要件該當性彙整：全 yes 成立、有 no 不成立、其餘待補證據', () => {
  const rows = claimStatus([
    { law: 'A', met: 'yes' }, { law: 'A', met: 'yes' },
    { law: 'B', met: 'yes' }, { law: 'B', met: 'no' },
    { law: 'C', met: 'unknown' }
  ]);
  assert.deepEqual(rows, [{ law: 'A', status: 'established' }, { law: 'B', status: 'failed' }, { law: 'C', status: 'pending' }]);
});

test('當事人準備清單分頁：依五類分組、匯出與列印按鈕；CSV 含標頭與 BOM', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    brainstorm: { facts: [], relations: [], issues: [], evidenceNeeds: [] },
    research: { laws: [], judgments: [], notes: [] },
    analysis: { elements: [], strategy: '', evidenceGaps: [], disclaimer: '' },
    assessment: { defenses: [], evidencePlan: [], riskSummary: '', checklist: [
      { category: '證據文件', item: '醫療費用單據正本', why: '證明損害額', dueHint: '起訴前' },
      { category: '程序事項', item: '委任狀', why: '委任律師訴訟代理', dueHint: '第一次開庭前' }
    ] },
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, activeTab: 'checklist', outputs: ['graph'] }, 'zh-TW');
  assert.match(html, /data-tab="checklist"/);
  assert.match(html, /你需要準備的東西/);
  assert.match(html, /<h3>證據文件<\/h3>[\s\S]*醫療費用單據正本/);
  assert.match(html, /<h3>程序事項<\/h3>[\s\S]*委任狀/);
  assert.match(html, /id="checklist-export"/);
  assert.match(html, /id="checklist-print"/);
  const csv = checklistCsv(status.result.assessment.checklist, 'zh-TW');
  assert.ok(csv.startsWith('﻿分類,項目,為何需要,時限'));
  assert.match(csv, /證據文件,醫療費用單據正本,證明損害額,起訴前/);
});

test('沒有清單資料時分頁不出現（undefined）', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: { analysis: { elements: [] }, graph: { nodes: [], edges: [] } } };
  assert.doesNotMatch(renderResult({ status, activeTab: 'graph', outputs: ['graph'] }, 'zh-TW'), /data-tab="checklist"/);
});

test('清單為空陣列時分頁也不出現', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    analysis: { elements: [] }, assessment: { defenses: [], evidencePlan: [], riskSummary: '', checklist: [] }, graph: { nodes: [], edges: [] } } };
  assert.doesNotMatch(renderResult({ status, activeTab: 'graph', outputs: ['graph'] }, 'zh-TW'), /data-tab="checklist"/);
});

test('清單分類標題以 i18n 呈現：en 顯示 Witnesses／Procedure，zh 維持中文不變', () => {
  const status = { status: 'COMPLETED', step: 'GRAPH', result: {
    brainstorm: { facts: [], relations: [], issues: [], evidenceNeeds: [] },
    research: { laws: [], judgments: [], notes: [] },
    analysis: { elements: [], strategy: '', evidenceGaps: [], disclaimer: '' },
    assessment: { defenses: [], evidencePlan: [], riskSummary: '', checklist: [
      { category: '人證', item: 'witness A', why: 'testify', dueHint: 'before hearing' },
      { category: '程序事項', item: 'POA', why: 'representation', dueHint: 'before first hearing' }
    ] },
    graph: { nodes: [], edges: [] } } };
  const htmlEn = renderResult({ status, activeTab: 'checklist', outputs: ['graph'] }, 'en');
  assert.match(htmlEn, /<h3>Witnesses<\/h3>/);
  assert.match(htmlEn, /<h3>Procedure<\/h3>/);
  const htmlZh = renderResult({ status, activeTab: 'checklist', outputs: ['graph'] }, 'zh-TW');
  assert.match(htmlZh, /<h3>人證<\/h3>/);
  assert.match(htmlZh, /<h3>程序事項<\/h3>/);
});

test('checklistCsv 對 LLM 產出的公式前綴欄位加單引號防 CSV 公式注入，且以 CRLF 分隔列', () => {
  const csv = checklistCsv([{ category: '其他', item: '=HYPERLINK("x")', why: '-1', dueHint: '+2' }], 'zh-TW');
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('﻿分類,項目,為何需要,時限'));
  assert.match(lines[1], /^其他,"'=HYPERLINK\(""x""\)"|^其他,'=HYPERLINK/);
  assert.match(lines[1], /'=HYPERLINK/);
  assert.match(lines[1], /'-1/);
  assert.match(lines[1], /'\+2/);
});

test('input 案情框失焦時縮成預覽（超長由 CSS 以 … 截斷），點預覽或聚焦即放大並回到輸入框', () => {
  const node = (extra = {}) => ({
    listeners: new Map(), hidden: false, classes: new Set(),
    classList: { toggle() {}, add(c) { this.owner.classes.add(c); }, remove(c) { this.owner.classes.delete(c); } },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    ...extra
  });
  const mk = (extra) => { const n = node(extra); n.classList.owner = n; return n; };
  let focused = 0;
  const textarea = mk({ value: '', focus() { focused++; } });
  const preview = mk({ textContent: '' });
  const bySelector = {
    '#case-text': textarea, '#case-preview': preview,
    '#case-files': mk({ files: [], value: '', click() {} }), '#case-submit': mk({ disabled: true }),
    '#case-count': mk({ textContent: '' }), '#file-status': mk({ textContent: '' }), '#file-dropzone': mk(), '#file-list': mk({ replaceChildren() {} })
  };
  const root = { querySelector: (sel) => bySelector[sel], querySelectorAll: (sel) => sel.includes('outputs') ? [mk({ checked: true, value: 'graph' })] : [] };
  bindInput(root, { onSubmit() {}, onSample() {} }, 'zh-TW');
  // 聚焦放大
  textarea.listeners.get('focus')();
  assert.ok(textarea.classes.has('expanded'));
  // 空內容失焦：縮小但不顯示預覽
  textarea.listeners.get('blur')();
  assert.ok(!textarea.classes.has('expanded'));
  assert.equal(preview.hidden, true);
  assert.equal(textarea.hidden, false);
  // 有內容失焦：預覽顯示全文（截斷交給 CSS line-clamp），輸入框隱藏
  textarea.value = '甲於2024年1月駕車撞傷乙，乙住院兩週並支出醫療費十萬元，甲拒絕賠償。';
  textarea.listeners.get('blur')();
  assert.equal(preview.hidden, false);
  assert.equal(textarea.hidden, true);
  assert.equal(preview.textContent, textarea.value);
  // 點預覽：回到輸入框、放大並取得焦點
  preview.listeners.get('click')();
  assert.equal(preview.hidden, true);
  assert.equal(textarea.hidden, false);
  assert.ok(textarea.classes.has('expanded'));
  assert.equal(focused, 1);
  // 標記含預覽元素
  assert.match(renderInput({ samples: [] }, 'zh-TW'), /id="case-preview" hidden/);
});

// 用途：首頁能力卡片與雙模式進度列（Task 11）
test('home 顯示兩張能力卡片，各帶 data-mode 與開始鈕', () => {
  const html = renderHome('zh-TW');
  assert.match(html, /class="capability[^"]*" data-mode="case"/);
  assert.match(html, /class="capability[^"]*" data-mode="contract"/);
  assert.match(html, /案件分析/); assert.match(html, /合約法規審查/);
  assert.equal((html.match(/data-mode="/g) || []).length >= 4, true, '卡片與按鈕都帶 data-mode');
});
test('progress 依 mode 切換步驤與文案', () => {
  assert.deepEqual(STEPS_BY_MODE.contract, ['LOAD', 'QUESTIONS', 'RESEARCH', 'REVIEW', 'SUMMARY', 'REVISE', 'GRAPH']);
  const html = renderProgress({ step: 'REVIEW', mode: 'contract' }, 'zh-TW');
  assert.match(html, /data-step="REVIEW"[^>]*aria-current="step"/);
  assert.match(html, /逐條檢查是否違法或不公平/);
  assert.match(renderProgress({ step: 'RESEARCH' }, 'zh-TW'), /class="step done"[^>]*data-step="BRAINSTORM"/);
});

test('input 合約模式顯示立場、範疇與 revised 勾選，不顯示書狀與聲請欄', () => {
  const html = renderInput({ samples: [{ id: 'labor-contract', title: '勞動契約', summary: 's' }], mode: 'contract' }, 'zh-TW');
  assert.match(html, /name="party" value="partyB"/);
  assert.match(html, /name="scopes" value="labor"/);
  assert.match(html, /name="outputs" value="revised"/);
  assert.doesNotMatch(html, /name="outputs" value="graph"/);
  assert.doesNotMatch(html, /id="motion-field"/);
  assert.match(html, /開始審查/);
  assert.match(html, /貼上合約原文/);
});

// 用途：bindHome 按鈕聚焦時按 Enter 不應由 keydown 監聽重複觸發 onSelect（原生 click 已會冒泡處理一次）
test('bindHome 按鈕聚焦按 Enter 時 keydown 監聽不重複觸發，只有原生 click 冒泡才算一次；卡片本身按 Enter 直接觸發', () => {
  const card = { dataset: { mode: 'case' }, listeners: new Map(), addEventListener(type, l) { this.listeners.set(type, l); } };
  const root = { querySelectorAll: () => [card] };
  let calls = 0;
  bindHome(root, { onSelect: () => { calls += 1; } });

  // 按鈕聚焦時按 Enter：keydown target 落在 button 內，keydown 監聽本身不應呼叫 onSelect
  const btn = {};
  const eOnButton = { key: 'Enter', target: { closest: (sel) => (sel === 'button' ? btn : null) } };
  card.listeners.get('keydown')(eOnButton);
  assert.equal(calls, 0);

  // 瀏覽器中按鈕的原生 click 會冒泡到卡片，模擬該冒泡：呼叫一次 click 監聽
  card.listeners.get('click')();
  assert.equal(calls, 1);

  // 卡片本身（非按鈕）聚焦按 Enter：keydown 監聽直接觸發
  const eOnCard = { key: 'Enter', target: { closest: () => null } };
  card.listeners.get('keydown')(eOnCard);
  assert.equal(calls, 2);
});

const contractStatus = { locale: 'zh-TW', mode: 'contract', result: {
  contract: { contractType: '勞動契約', scopes: ['labor'], parties: [{ name: '○○科技', role: '甲方（雇主）' }], clauses: [{ clauseNo: '第二條', text: 'x' }], summary: '摘要' },
  research: { laws: [{ ref: '勞動基準法第24條', title: '勞基法 24' }], judgments: [], notes: [] },
  findings: { findings: [], notes: [] },
  compliance: { contractType: '勞動契約', scopes: ['labor'], overallRisk: 'high', priorities: ['先改第二條'], disclaimer: '免責',
    findings: [
      { clauseNo: '第二條', clauseText: '不發加班費', risk: 'high', lawRefs: ['勞動基準法第24條'], riskPoint: '違反強行規定', suggestion: '依勞基法辦理', judgmentCitations: [] },
      { clauseNo: '第五條', clauseText: '<b>調動</b>', risk: 'medium', lawRefs: [], riskPoint: '範圍不明', suggestion: '限縮', judgmentCitations: [] }
    ] } } };

test('合約模式分頁順序與風險清單', () => {
  assert.deepEqual(tabsFor([], false, 'contract', contractStatus.result), ['findings', 'summary', 'laws']);
  assert.deepEqual(tabsFor(['revised'], false, 'contract', { graph: {} }), ['findings', 'summary', 'doc-revised', 'graph', 'laws']);
  const html = renderResult({ status: contractStatus, outputs: [], mode: 'contract' }, 'zh-TW');
  assert.match(html, /data-tab="findings"[^>]*>風險條款清單/);
  assert.match(html, /<tr data-risk="high">/); assert.match(html, /<tr data-risk="medium">/);
  assert.match(html, /&lt;b&gt;調動&lt;\/b&gt;/);
  assert.match(html, /id="findings-filter"/); assert.match(html, /data-risk="all"/);
  assert.match(html, /id="findings-export"/);
  assert.match(html, /整體風險/); assert.match(html, /先改第二條/);
  assert.match(html, /勞動基準法第24條/);
});
test('riskFilter 只顯示該級條款', () => {
  const html = renderResult({ status: contractStatus, outputs: [], mode: 'contract', riskFilter: 'high' }, 'zh-TW');
  assert.match(html, /<tr data-risk="high">/); assert.doesNotMatch(html, /<tr data-risk="medium">/);
});
test('findingsCsv 含 BOM、表頭與公式注入防護', () => {
  const csv = findingsCsv([{ clauseNo: '=1+1', clauseText: 'a,b', risk: 'high', lawRefs: ['民法第71條'], riskPoint: '', suggestion: '', judgmentCitations: [] }], 'zh-TW');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /條款,條款原文,風險,法規依據,風險點,修改建議,佐證判決/);
  assert.match(csv, /'=1\+1,"a,b",高,民法第71條/);
});
test('renderSections 合約模式列出契約摘要與條款數', () => {
  const html = renderSections({ contract: contractStatus.result.contract }, 'zh-TW', 'contract');
  assert.match(html, /data-section="contract"/); assert.match(html, /勞動契約/); assert.match(html, /1/);
});
