import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';

/** 結果頁四個分頁的固定順序。 */
const TABS = ['graph', 'analysis', 'research', 'brainstorm'];

/** 要件該當性符號（對應 legal-element-analysis 涵攝表）。 */
const metMark = (m) => (m === 'yes' ? '○' : m === 'no' ? '✗' : '△');
/** 要件該當性 → 樣式類別與 i18n 鍵（yes／no 以外一律視為 unknown）。 */
const metKey = (m) => (m === 'yes' || m === 'no' ? m : 'unknown');

/** 以清單呈現陣列；f 為每項取文字的函式；所有文字經 esc。 */
const list = (arr, f = (x) => x) => `<ul>${(arr || []).map((x) => `<li>${esc(f(x))}</li>`).join('')}</ul>`;

/** 構成要件涵攝表：每列符號徽章（符號＋文字＋顏色三重編碼）、法條、要件、依據。 */
function elementsList(elements, locale) {
  const rows = (elements || []).map((e) => {
    const k = metKey(e.met);
    return `<li class="el el-${k}"><span class="el-badge">${metMark(e.met)} ${esc(t('graph.met.' + k, locale).replace(/^[○✗△]\s*/, ''))}</span>
      <div class="el-head">${esc(e.element)} <span class="el-law">· ${esc(e.law)}</span></div><div class="el-basis">${esc(e.basis)}</div></li>`;
  }).join('');
  return `<ul class="elements">${rows}</ul>`;
}

/** 三段文字型成果（brainstorm／research／analysis）的 HTML 產生器；graph 由 graphView 渲染。 */
const SECTION_HTML = {
  brainstorm: (b, locale) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.facts')}${list(b.facts)}${h3('result.relations')}${list(b.relations)}
      ${h3('result.issues')}${list(b.issues)}${h3('result.evidenceNeeds')}${list(b.evidenceNeeds)}`;
  },
  research: (r, locale) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.statutes')}${list(r.laws, (l) => `${l.title}（${l.ref}）`)}${h3('result.judgments')}${list(r.judgments, (j) => j.citation)}
      ${h3('result.notes')}${list(r.notes)}`;
  },
  analysis: (a, locale) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.elements')}${elementsList(a.elements, locale)}
      ${h3('result.strategy')}<p>${esc(a.strategy)}</p>${h3('result.evidenceGaps')}${list(a.evidenceGaps)}
      <p class="disclaimer">${ICONS.info}<span>${esc(a.disclaimer)}</span></p>`;
  }
};

/** 進行中／等待回答時的「目前成果」：只列出已產生的段落（brainstorm → research → analysis），無任何段落回空字串。 */
export function renderSections(result, locale) {
  if (!result) return '';
  const present = ['brainstorm', 'research', 'analysis'].filter((k) => result[k]);
  if (!present.length) return '';
  const blocks = present.map((k) => `<details class="partial" data-section="${k}" open>
      <summary>${esc(t('result.tab.' + k, locale))}</summary>${SECTION_HTML[k](result[k], locale)}</details>`).join('');
  return `<section class="partials"><h2>${esc(t('progress.partial', locale))}</h2>${blocks}</section>`;
}

/** 結果頁：Graph 分頁放渲染器骨架（graphView 接圖），其餘分頁以清單呈現；分頁具 tablist／tab／tabpanel 語意；所有模型文字經 esc。 */
export function renderResult({ status, activeTab = 'graph' }, locale) {
  const r = status.result || {};
  const tabs = TABS.map((k) =>
    `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${k === activeTab}" class="tab ${k === activeTab ? 'active' : ''}" data-tab="${k}">${esc(t('result.tab.' + k, locale))}</button>`).join('');
  const panels = {
    graph: `<div class="graph-wrap">
        <div class="graph-side control-panel">
          <div class="section-title">${esc(t('graph.filter', locale))}</div><div id="filter-box"></div>
          <div class="section-title">${esc(t('graph.family', locale))}</div><div id="family-box"></div>
          <label class="field-label" for="search-input" hidden>${esc(t('graph.search', locale))}</label>
          <input id="search-input" type="text" placeholder="${esc(t('graph.search', locale))}" aria-label="${esc(t('graph.search', locale))}">
        </div>
        <div id="network-canvas"></div>
        <aside class="detail-panel" id="detail-panel" aria-label="${esc(t('graph.detail.aria', locale))}"><button class="close-btn" id="close-panel-btn" type="button" aria-label="${esc(t('graph.close', locale))}">${ICONS.close}</button>
          <div class="detail-header"><span class="detail-tag" id="detail-tag"></span><h2 class="detail-title" id="detail-title"></h2></div>
          <div class="detail-body" id="detail-body"></div></aside></div>`,
    analysis: SECTION_HTML.analysis(r.analysis || {}, locale),
    research: SECTION_HTML.research(r.research || {}, locale),
    brainstorm: SECTION_HTML.brainstorm(r.brainstorm || {}, locale)
  };
  return `<section class="result"><nav class="tabs"><div class="tablist" role="tablist" aria-label="${esc(t('result.tabs.aria', locale))}">${tabs}</div><span class="gen">${esc(t('result.generatedIn', locale))}: ${esc(status.locale)}</span>
    <button id="new-case" type="button">${ICONS.plus}${esc(t('result.newCase', locale))}</button></nav>
    ${TABS.map((k) => `<div class="panel card" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}" data-panel="${k}" ${k === activeTab ? '' : 'hidden'}>${panels[k]}</div>`).join('')}</section>`;
}

/** 分頁切換（點選＋左右方向鍵）與新案件。 */
export function bindResult(root, { onTab, onNewCase }) {
  const tabs = [...root.querySelectorAll('.tab')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => onTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      onTab(next.dataset.tab);
      root.querySelector(`#tab-${next.dataset.tab}`)?.focus();
    });
  });
  root.querySelector('#new-case').addEventListener('click', onNewCase);
}
