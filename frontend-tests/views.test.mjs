import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/main/resources/static/js/views/util.js';
import { bindInput, renderInput } from '../src/main/resources/static/js/views/input.js';
import { renderProgress, renderCancel } from '../src/main/resources/static/js/views/progress.js';
import { renderQuestions } from '../src/main/resources/static/js/views/questions.js';
import { renderResult, renderSections } from '../src/main/resources/static/js/views/result.js';

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
test('progress 高亮當前步驤且之前步驤標 done', () => {
  const html = renderProgress({ step: 'RESEARCH' }, 'zh-TW');
  assert.match(html, /class="step done"[^>]*data-step="BRAINSTORM"/);
  assert.match(html, /class="step active"[^>]*data-step="RESEARCH"/);
  assert.match(html, /檢索法條與判決/);
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
test('爭點整理以實務爭點整理表呈現：欄位表頭、逐列兩造主張、內容轉義，並附 CSV 匯出連結', () => {
  const status = { locale: 'zh-TW', result: {
    documents: [{ type: 'issues', title: '爭點整理', court: '臺灣臺北地方法院',
      parties: [{ role: '原告', name: '甲' }], paragraphs: ['本件爭點整理如下：'],
      issues: [
        { no: '一', issue: '被告有無過失', plaintiff: '被告未保持安全距離', defendant: '<原告>突然變換車道',
          basis: '民法第184條第1項', evidence: '證一：行車紀錄器', court: '審酌行車紀錄器影像' },
        { no: '二', issue: '損害額', plaintiff: '修車費 5 萬', defendant: '應扣折舊', basis: '民法第196條', evidence: '證二：估價單', court: '' }
      ], attachments: [], date: '' }],
    graph: { nodes: [], edges: [] } } };
  const html = renderResult({ status, outputs: ['issues'] }, 'zh-TW');
  assert.match(html, /<table class="issue-table"/);
  assert.match(html, /<th[^>]*>爭點<\/th>/);
  assert.match(html, /<th[^>]*>原告主張<\/th>/);
  assert.match(html, /<th[^>]*>被告主張<\/th>/);
  assert.match(html, /<th[^>]*>法律依據<\/th>/);
  assert.match(html, /<th[^>]*>證據方法<\/th>/);
  assert.match(html, /被告未保持安全距離/);
  assert.match(html, /&lt;原告&gt;突然變換車道/);
  assert.match(html, /損害額/);
  assert.match(html, /href="data:text\/csv;charset=utf-8,/);
  assert.match(html, /download="爭點整理\.csv"/);
  // CSV 內容需含表頭與兩列資料（URL 編碼後仍可找到欄位名）
  assert.match(html, new RegExp(encodeURIComponent('爭點')));
  assert.match(html, new RegExp(encodeURIComponent('民法第196條')));
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
