import { t } from '../i18n.js';
import { esc } from './util.js';

/** 結果頁四個分頁的固定順序。 */
const TABS = ['graph', 'analysis', 'research', 'brainstorm'];

/** 要件該當性符號（對應 legal-element-analysis 涵攝表）。 */
const metMark = (m) => (m === 'yes' ? '○' : m === 'no' ? '✗' : '△');

/** 結果頁：Graph 分頁放渲染器骨架（graphView 接圖），其餘分頁以清單呈現；所有模型文字經 esc。 */
export function renderResult({ status, activeTab = 'graph' }, locale) {
  const r = status.result || {};
  const brainstorm = r.brainstorm || {}, research = r.research || {}, analysis = r.analysis || {};
  const tabs = TABS.map((k) =>
    `<button type="button" class="tab ${k === activeTab ? 'active' : ''}" data-tab="${k}">${esc(t('result.tab.' + k, locale))}</button>`).join('');
  const list = (arr, f = (x) => x) => `<ul>${(arr || []).map((x) => `<li>${esc(f(x))}</li>`).join('')}</ul>`;
  const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
  const panels = {
    graph: `<div class="graph-wrap">
        <div class="graph-side control-panel">
          <div class="section-title">${esc(t('graph.filter', locale))}</div><div id="filter-box"></div>
          <div class="section-title">${esc(t('graph.family', locale))}</div><div id="family-box"></div>
          <input id="search-input" type="text" placeholder="${esc(t('graph.search', locale))}">
        </div>
        <div id="network-canvas"></div>
        <aside class="detail-panel" id="detail-panel"><button class="close-btn" id="close-panel-btn" type="button">✕</button>
          <div class="detail-header"><span class="detail-tag" id="detail-tag"></span><h2 class="detail-title" id="detail-title"></h2></div>
          <div class="detail-body" id="detail-body"></div></aside></div>`,
    analysis: `${h3('result.elements')}${list(analysis.elements, (e) => `${metMark(e.met)} ${e.law} — ${e.element}: ${e.basis}`)}
      ${h3('result.strategy')}<p>${esc(analysis.strategy)}</p>${h3('result.evidenceGaps')}${list(analysis.evidenceGaps)}
      <p class="disclaimer">${esc(analysis.disclaimer)}</p>`,
    research: `${h3('result.statutes')}${list(research.laws, (l) => `${l.title}（${l.ref}）`)}${h3('result.judgments')}${list(research.judgments, (j) => j.citation)}
      ${h3('result.notes')}${list(research.notes)}`,
    brainstorm: `${h3('result.facts')}${list(brainstorm.facts)}${h3('result.relations')}${list(brainstorm.relations)}
      ${h3('result.issues')}${list(brainstorm.issues)}${h3('result.evidenceNeeds')}${list(brainstorm.evidenceNeeds)}`
  };
  return `<section class="result"><nav class="tabs">${tabs}<span class="gen">${esc(t('result.generatedIn', locale))}: ${esc(status.locale)}</span>
    <button id="new-case" type="button">${esc(t('result.newCase', locale))}</button></nav>
    ${TABS.map((k) => `<div class="panel" data-panel="${k}" ${k === activeTab ? '' : 'hidden'}>${panels[k]}</div>`).join('')}</section>`;
}

/** 分頁切換與新案件。 */
export function bindResult(root, { onTab, onNewCase }) {
  root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => onTab(b.dataset.tab)));
  root.querySelector('#new-case').addEventListener('click', onNewCase);
}
