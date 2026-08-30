import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/main/resources/static/js/views/util.js';
import { renderInput } from '../src/main/resources/static/js/views/input.js';
import { renderProgress } from '../src/main/resources/static/js/views/progress.js';
import { renderQuestions } from '../src/main/resources/static/js/views/questions.js';
import { renderResult } from '../src/main/resources/static/js/views/result.js';

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
test('questions 每題一個 textarea，name 為 questionId', () => {
  const html = renderQuestions({ questions: [{ id: 'q1', text: 'Dashcam?', why: 'causation' }] }, 'en');
  assert.match(html, /<textarea[^>]*name="q1"/);
  assert.match(html, /causation/);
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
