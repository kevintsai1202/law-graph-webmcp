import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/main/resources/static/js/views/util.js';
import { renderInput } from '../src/main/resources/static/js/views/input.js';
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
