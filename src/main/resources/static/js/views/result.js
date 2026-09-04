import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';
import { DOC_TYPES, normalizeOutputs } from '../documents.js';

/** 三個固定殿後的輔助分頁。 */
const AUX_TABS = ['analysis', 'research', 'brainstorm'];

/** 依勾選輸出組出分頁順序：關聯圖、各書狀（doc-<type>）、輔助分頁。 */
export function tabsFor(outputs) {
  const selected = normalizeOutputs(outputs);
  const front = ['graph', ...DOC_TYPES].filter((o) => selected.includes(o))
    .map((o) => (o === 'graph' ? 'graph' : 'doc-' + o));
  return [...front, ...AUX_TABS];
}

/** 分頁標籤文字：graph／輔助分頁沿用 result.tab.*，書狀用 doc.* 狀別名稱。 */
export function tabLabel(tab, locale) {
  return tab.startsWith('doc-') ? t('doc.' + tab.slice(4), locale) : t('result.tab.' + tab, locale);
}

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
    const coverage = r.coverage || {};
    const evidenceByJid = new Map((r.evidence || []).map((e) => [e.judgment?.jid, e]));
    const coverageLine = r.coverage
      ? `<p class="research-coverage">${esc(t('result.coverage', locale))}：keyword=${esc(coverage.keywordStatus || '')}；semantic=${esc(coverage.semanticStatus || '')}；merged=${esc(String(coverage.mergedCount ?? 0))}</p>`
      : '';
    const judgmentText = (j) => {
      const sources = evidenceByJid.get(j.jid)?.sources || [];
      return sources.length ? `${j.citation} [${sources.join('+')}]` : j.citation;
    };
    return `${coverageLine}${h3('result.statutes')}${list(r.laws, (l) => `${l.title}（${l.ref}）`)}${h3('result.judgments')}${list(r.judgments, judgmentText)}
      ${h3('result.notes')}${list(r.notes)}`;
  },
  analysis: (a, locale) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.elements')}${elementsList(a.elements, locale)}
      ${h3('result.strategy')}<p>${esc(a.strategy)}</p>${h3('result.evidenceGaps')}${list(a.evidenceGaps)}
      <p class="disclaimer">${ICONS.info}<span>${esc(a.disclaimer)}</span></p>`;
  }
};

/** 司法院官方三張表的欄位順序（i18n 鍵尾碼＝後端 record 欄名）。 */
const ISSUE_COLUMNS = ['no', 'issue', 'plaintiff', 'plaintiffEvidence', 'defendant', 'defendantEvidence', 'basis'];
const CLAIM_COLUMNS = ['no', 'basis', 'claim'];
const UNDISPUTED_COLUMNS = ['no', 'fact', 'evidence'];

/** CSV 欄位轉義：含逗號、引號、換行者以雙引號包住並將引號加倍。 */
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 司法院官方表格（爭點整理表／聲明與請求權基礎清單／不爭執事項清單）通用渲染：
 * 表頭與欄位依 i18n 前綴取字，附 CSV 匯出（含 UTF-8 BOM，Excel 直接開啟不會亂碼）。
 */
function renderOfficialTable(rows, columns, prefix, locale) {
  const head = columns.map((c) => `<th scope="col">${esc(t(prefix + '.' + c, locale))}</th>`).join('');
  const body = rows.map((row) =>
    `<tr>${columns.map((c) => `<td>${esc(row[c] || '')}</td>`).join('')}</tr>`).join('');
  const csv = [columns.map((c) => t(prefix + '.' + c, locale)), ...rows.map((row) => columns.map((c) => row[c] || ''))]
    .map((line) => line.map(csvCell).join(',')).join('\r\n');
  const href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  return `<div class="issue-toolbar"><h4 class="doc-section">${esc(t(prefix + '.title', locale))}</h4><a class="doc-export" href="${href}" download="${esc(t(prefix + '.file', locale))}">${ICONS.download || ''}${esc(t('doc.issue.export', locale))}</a></div>
    <div class="issue-table-wrap"><table class="issue-table ${prefix.replace('doc.', '')}-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** 依書狀內容輸出官方表格：不爭執事項 → 聲明與請求權基礎 → 爭點整理表（與準備書狀範本附表順序一致）。 */
function renderDocumentTables(doc, locale) {
  const parts = [];
  if (Array.isArray(doc.undisputed) && doc.undisputed.length) parts.push(renderOfficialTable(doc.undisputed, UNDISPUTED_COLUMNS, 'doc.undisputed', locale));
  if (Array.isArray(doc.claimsBasis) && doc.claimsBasis.length) parts.push(renderOfficialTable(doc.claimsBasis, CLAIM_COLUMNS, 'doc.claims', locale));
  if (Array.isArray(doc.issues) && doc.issues.length) parts.push(renderOfficialTable(doc.issues, ISSUE_COLUMNS, 'doc.issue', locale));
  return parts.join('');
}

/** 台灣公文書狀版面：狀別標題、當事人欄、本文段落、證物清單、此致法院與日期；全文經 esc。爭點整理另插入爭點整理表。 */
function renderDocument(doc, locale) {
  if (!doc) return `<p class="doc-missing">${ICONS.info}<span>${esc(t('doc.missing', locale))}</span></p>`;
  const issueTable = renderDocumentTables(doc, locale);
  const parties = (doc.parties || []).map((p) =>
    `<tr><th scope="row">${esc(p.role)}</th><td>${esc(p.name)}</td></tr>`).join('');
  const paragraphs = (doc.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');
  const attachments = (doc.attachments || []).length
    ? `<h4 class="doc-section">${esc(t('doc.attachments', locale))}</h4><ol class="doc-attachments">${doc.attachments.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>`
    : '';
  return `<article class="legal-doc">
      <h3 class="doc-title">${esc(doc.title || '')}</h3>
      ${parties ? `<table class="doc-parties" aria-label="${esc(t('doc.parties', locale))}"><tbody>${parties}</tbody></table>` : ''}
      <div class="doc-body">${paragraphs}</div>
      ${issueTable}
      ${attachments}
      <p class="doc-footer"><span class="doc-to">${esc(t('doc.to', locale))} ${esc(doc.court || '')}</span><span class="doc-date">${esc(doc.date || '')}</span></p>
      <p class="disclaimer">${ICONS.info}<span>${esc(t('doc.disclaimer', locale))}</span></p>
    </article>`;
}

/** 進行中／等待回答時的「目前成果」：只列出已產生的段落（brainstorm → research → analysis），無任何段落回空字串。 */
export function renderSections(result, locale) {
  if (!result) return '';
  const present = ['brainstorm', 'research', 'analysis'].filter((k) => result[k]);
  if (!present.length) return '';
  const blocks = present.map((k) => `<details class="partial" data-section="${k}" open>
      <summary>${esc(t('result.tab.' + k, locale))}</summary>${SECTION_HTML[k](result[k], locale)}</details>`).join('');
  return `<section class="partials"><h2>${esc(t('progress.partial', locale))}</h2>${blocks}</section>`;
}

/** 結果頁：勾選輸出各自一個分頁排前（Graph 骨架由 graphView 接圖、書狀公文版面），輔助分頁殿後；所有模型文字經 esc。 */
export function renderResult({ status, activeTab = 'graph', outputs }, locale) {
  const r = status.result || {};
  const TABS = tabsFor(outputs);
  if (!TABS.includes(activeTab)) activeTab = TABS[0];
  const tabs = TABS.map((k) =>
    `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${k === activeTab}" class="tab ${k === activeTab ? 'active' : ''}" data-tab="${k}">${esc(tabLabel(k, locale))}</button>`).join('');
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
  // 各書狀分頁：以 type 對應後端 result.documents；缺件時顯示未產生提示
  for (const k of TABS) {
    if (!k.startsWith('doc-')) continue;
    const type = k.slice(4);
    panels[k] = renderDocument((r.documents || []).find((d) => d.type === type), locale);
  }
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
