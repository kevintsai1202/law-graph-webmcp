import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';
import { DOC_TYPES, normalizeOutputs } from '../documents.js';

/** 三個固定殿後的輔助分頁。 */
const AUX_TABS = ['analysis', 'research', 'brainstorm'];

/** 依勾選輸出組出分頁順序：案件模式為關聯圖、各書狀（doc-<type>）、（有清單資料才有）當事人準備清單、輔助分頁；
 *  合約模式為風險清單、合規摘要、（勾選修訂條款才有）修訂條款、（有關係圖資料才有）關係圖、法源。 */
export function tabsFor(outputs, hasChecklist = false, mode = 'case', result = null) {
  if (mode === 'contract') {
    const selected = normalizeOutputs(outputs, 'contract');
    return ['findings', 'summary', ...(selected.includes('revised') ? ['doc-revised'] : []), ...(result?.graph ? ['graph'] : []), 'laws'];
  }
  const selected = normalizeOutputs(outputs);
  const front = ['graph', ...DOC_TYPES].filter((o) => selected.includes(o))
    .map((o) => (o === 'graph' ? 'graph' : 'doc-' + o));
  return [...front, ...(hasChecklist ? ['checklist'] : []), ...AUX_TABS];
}

/** 分頁標籤文字：graph／輔助分頁／checklist 沿用 result.tab.*，書狀用 doc.* 狀別名稱。 */
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

/** 依 law 分組彙整請求權成立狀態：全部 yes → established；任一 no → failed；其餘 → pending。保留首次出現順序。 */
export function claimStatus(elements) {
  const byLaw = new Map();
  (elements || []).forEach((e) => { if (!byLaw.has(e.law)) byLaw.set(e.law, []); byLaw.get(e.law).push(e.met); });
  return [...byLaw.entries()].map(([law, mets]) => ({
    law, status: mets.some((m) => m === 'no') ? 'failed' : mets.every((m) => m === 'yes') ? 'established' : 'pending'
  }));
}

/** 請求權基礎小結清單。 */
function claimSummaryList(elements, locale) {
  const rows = claimStatus(elements).map((r) =>
    `<li class="claim claim-${r.status}">${esc(r.law)}<span class="claim-status">${esc(t('claim.' + r.status, locale))}</span></li>`).join('');
  return rows ? `<ul class="claim-summary">${rows}</ul>` : '';
}

/** 對造抗辯表：爭點／抗辯／回應／風險徽章。 */
function defensesTable(defenses, locale) {
  if (!defenses?.length) return `<p class="empty">${esc(t('result.none', locale))}</p>`;
  const head = ['defense.issue', 'defense.defense', 'defense.response', 'defense.risk'].map((k) => `<th>${esc(t(k, locale))}</th>`).join('');
  const rows = defenses.map((d) => `<tr><td>${esc(d.issue)}</td><td>${esc(d.defense)}</td><td>${esc(d.response)}</td><td><span class="risk risk-${esc(d.risk || 'medium')}">${esc(t('risk.' + (d.risk || 'medium'), locale))}</span></td></tr>`).join('');
  return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 證據與舉證責任表：待證事實／舉證責任／現有證據／缺口／取得方式。 */
function evidenceTable(items, locale) {
  if (!items?.length) return `<p class="empty">${esc(t('result.none', locale))}</p>`;
  const head = ['evidence.fact', 'evidence.burden', 'evidence.available', 'evidence.missing', 'evidence.howToObtain'].map((k) => `<th>${esc(t(k, locale))}</th>`).join('');
  const rows = items.map((e) => `<tr><td>${esc(e.fact)}</td><td>${esc(e.burden)}</td><td>${esc(e.available)}</td><td>${esc(e.missing)}</td><td>${esc(e.howToObtain)}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 五個固定分類的顯示順序（提示詞產出的分組鍵，維持中文字串不變）；模型給出其他字串時歸入「其他」。 */
const CHECKLIST_CATEGORIES = ['證據文件', '人證', '程序事項', '費用與期限', '其他'];
/** 分類鍵 → i18n 鍵尾碼，供標題與 CSV 欄位依語系顯示（不影響上面的分組鍵本身）。 */
const CHECKLIST_CATEGORY_I18N = {
  '證據文件': 'evidence', '人證': 'witness', '程序事項': 'procedure', '費用與期限': 'cost', '其他': 'other'
};
/** 依語系取得分類顯示文字。 */
const checklistCatLabel = (cat, locale) => t('checklist.cat.' + (CHECKLIST_CATEGORY_I18N[cat] || 'other'), locale);

/** 當事人準備清單：依分類分組的表格，加匯出與列印按鈕。 */
function checklistTable(items, locale) {
  const groups = new Map(CHECKLIST_CATEGORIES.map((c) => [c, []]));
  (items || []).forEach((i) => groups.get(CHECKLIST_CATEGORIES.includes(i.category) ? i.category : '其他').push(i));
  const sections = [...groups.entries()].filter(([, rows]) => rows.length).map(([cat, rows]) => `<h3>${esc(checklistCatLabel(cat, locale))}</h3>
    <div class="table-wrap"><table class="assess-table checklist-table"><thead><tr><th>${esc(t('checklist.item', locale))}</th><th>${esc(t('checklist.why', locale))}</th><th>${esc(t('checklist.due', locale))}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.why)}</td><td>${esc(r.dueHint || '')}</td></tr>`).join('')}</tbody></table></div>`).join('');
  return `<section class="checklist" id="checklist-sheet"><p class="lead">${esc(t('checklist.lead', locale))}</p>${sections}
    <div class="actions"><button type="button" id="checklist-export" class="secondary">${esc(t('checklist.export', locale))}</button>
    <button type="button" id="checklist-print" class="secondary">${esc(t('checklist.print', locale))}</button></div></section>`;
}

/** 清單 CSV（含 BOM 讓 Excel 正確讀 UTF-8）：分類、項目、為何需要、時限；含雙引號、逗號或換行的欄位依 RFC 4180 轉義；
 *  以 = + - @ Tab CR 開頭的欄位另加單引號前綴，避免 LLM 產出內容在 Excel/Sheets 被當公式執行（CSV 公式注入）。 */
export function checklistCsv(items, locale) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [t('checklist.category', locale), t('checklist.item', locale), t('checklist.why', locale), t('checklist.due', locale)].join(',');
  return '﻿' + [head, ...(items || []).map((i) => [checklistCatLabel(CHECKLIST_CATEGORIES.includes(i.category) ? i.category : '其他', locale), i.item, i.why, i.dueHint].map(cell).join(','))].join('\r\n');
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
  analysis: (a, locale, assessment = null) => {
    const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
    return `${h3('result.elements')}${elementsList(a.elements, locale)}
      ${h3('result.claimSummary')}${claimSummaryList(a.elements, locale)}
      ${h3('result.defenses')}${defensesTable(assessment?.defenses, locale)}
      ${h3('result.evidencePlan')}${evidenceTable(assessment?.evidencePlan, locale)}
      ${h3('result.strategy')}<p>${esc(a.strategy || '')}</p>
      ${assessment?.riskSummary ? `${h3('result.risk')}<p>${esc(assessment.riskSummary)}</p>` : ''}
      ${h3('result.evidenceGaps')}${list(a.evidenceGaps)}
      <p class="disclaimer">${ICONS.info}<span>${esc(a.disclaimer)}</span></p>`;
  }
};

/** 風險徽章：色塊＋文字（不只靠顏色，同時附符號）。 */
const riskBadge = (risk, locale) => `<span class="risk risk-${esc(risk || 'medium')}">${risk === 'high' ? '🔴' : risk === 'low' ? '🟢' : '🟡'} ${esc(t('risk.' + (risk || 'medium'), locale))}</span>`;

/** 風險條款清單：篩選鈕（all/high/medium/low）、表格（每列帶 data-risk）、CSV 匯出鈕。 */
function findingsTable(findings, locale, riskFilter = 'all') {
  const rows = (findings || []).filter((f) => riskFilter === 'all' || f.risk === riskFilter);
  const filters = ['all', 'high', 'medium', 'low'].map((r) => `<button type="button" class="chip ${r === riskFilter ? 'active' : ''}" data-risk="${r}" aria-pressed="${r === riskFilter}">${esc(r === 'all' ? t('finding.filter.all', locale) : t('risk.' + r, locale))}</button>`).join('');
  const head = ['clauseNo', 'clauseText', 'risk', 'lawRefs', 'riskPoint', 'suggestion', 'judgments'].map((k) => `<th scope="col">${esc(t('finding.' + k, locale))}</th>`).join('');
  const body = rows.map((f) => `<tr data-risk="${esc(f.risk || 'medium')}"><td>${esc(f.clauseNo)}</td><td class="clause-text">${esc(f.clauseText)}</td><td>${riskBadge(f.risk, locale)}</td>
    <td>${list(f.lawRefs)}</td><td>${esc(f.riskPoint)}</td><td>${esc(f.suggestion)}</td><td>${list(f.judgmentCitations)}</td></tr>`).join('');
  const table = rows.length ? `<div class="table-wrap"><table class="assess-table findings-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">${esc(t('finding.none', locale))}</p>`;
  return `<div class="findings-toolbar"><div id="findings-filter" role="group" aria-label="${esc(t('finding.risk', locale))}">${filters}</div>
    <button type="button" id="findings-export" class="secondary">${esc(t('finding.export', locale))}</button></div>${table}`;
}

/** 風險條款 CSV（含 BOM，RFC 4180，防公式注入，規則同 checklistCsv）。 */
export function findingsCsv(findings, locale) {
  const head = ['clauseNo', 'clauseText', 'risk', 'lawRefs', 'riskPoint', 'suggestion', 'judgments'].map((k) => t('finding.' + k, locale)).join(',');
  const lines = (findings || []).map((f) => [f.clauseNo, f.clauseText, t('risk.' + (f.risk || 'medium'), locale), (f.lawRefs || []).join('；'), f.riskPoint, f.suggestion, (f.judgmentCitations || []).join('；')].map(csvCell).join(','));
  return '﻿' + [head, ...lines].join('\r\n');
}

/** 合規摘要面板：契約類型、當事人、審查範疇、整體風險、優先修改建議與免責聲明。 */
function summaryPanel(result, locale) {
  const c = result.compliance || {}, b = result.contract || {};
  const h3 = (key) => `<h3>${esc(t(key, locale))}</h3>`;
  const parties = (b.parties || []).map((p) => `${p.role}：${p.name}`);
  return `${h3('summary.contractType')}<p>${esc(c.contractType || b.contractType || '')}</p>
    ${parties.length ? h3('summary.parties') + list(parties) : ''}
    ${h3('summary.scopes')}${list(c.scopes || [], (s) => t('contract.scope.' + s, locale))}
    ${h3('summary.overall')}<p>${riskBadge(c.overallRisk, locale)}</p>
    ${h3('summary.priorities')}${list(c.priorities)}
    <p class="disclaimer">${ICONS.info}<span>${esc(c.disclaimer || '')}</span></p>`;
}

/** 合約模式進行中的中間成果：契約摘要（類型、條款數、摘要）。 */
SECTION_HTML.contract = (b, locale) => `<p><b>${esc(t('summary.contractType', locale))}</b>：${esc(b.contractType || '')}（${(b.clauses || []).length}）</p><p>${esc(b.summary || '')}</p>`;
/** 合約模式進行中的中間成果：風險條款清單（不含篩選、匯出，僅表格本體）。 */
SECTION_HTML.findings = (f, locale) => findingsTable(f?.findings, locale);

/** 司法院官方三張表的欄位順序（i18n 鍵尾碼＝後端 record 欄名）。 */
const ISSUE_COLUMNS = ['no', 'issue', 'plaintiff', 'plaintiffEvidence', 'defendant', 'defendantEvidence', 'basis'];
const CLAIM_COLUMNS = ['no', 'basis', 'claim'];
const UNDISPUTED_COLUMNS = ['no', 'fact', 'evidence'];

/** CSV 欄位轉義：以 = + - @ Tab CR 開頭者先加單引號前綴防公式注入，再依含逗號、引號、換行者以雙引號包住並將引號加倍。 */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
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

/** 修訂條款版面（M1 里程碑僅顯示未產生提示，M2 補逐條對照表）。 */
function renderRevised(revised, locale) {
  return revised?.items?.length ? '' : `<p class="doc-missing">${ICONS.info}<span>${esc(t('doc.missing', locale))}</span></p>`;
}

/** 進行中／等待回答時的「目前成果」：案件模式列出 brainstorm → research → analysis，合約模式列出 contract → research → findings；
 *  只列出已產生的段落，無任何段落回空字串。 */
export function renderSections(result, locale, mode = 'case') {
  if (!result) return '';
  const keys = mode === 'contract' ? ['contract', 'research', 'findings'] : ['brainstorm', 'research', 'analysis'];
  const present = keys.filter((k) => result[k]);
  if (!present.length) return '';
  const label = (k) => (k === 'contract' ? t('summary.contractType', locale) : t('result.tab.' + k, locale));
  const blocks = present.map((k) => `<details class="partial" data-section="${k}" open>
      <summary>${esc(label(k))}</summary>${SECTION_HTML[k](result[k], locale, result.assessment)}</details>`).join('');
  return `<section class="partials"><h2>${esc(t('progress.partial', locale))}</h2>${blocks}</section>`;
}

/** 結果頁：勾選輸出各自一個分頁排前（Graph 骨架由 graphView 接圖、書狀公文版面），輔助分頁殿後；所有模型文字經 esc。 */
export function renderResult({ status, activeTab = 'graph', outputs, mode = status?.mode || 'case', riskFilter = 'all' }, locale) {
  const r = status.result || {};
  const TABS = tabsFor(outputs, !!r.assessment?.checklist?.length, mode, r);
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
    analysis: SECTION_HTML.analysis(r.analysis || {}, locale, r.assessment),
    research: SECTION_HTML.research(r.research || {}, locale),
    brainstorm: SECTION_HTML.brainstorm(r.brainstorm || {}, locale),
    checklist: checklistTable(r.assessment?.checklist, locale),
    findings: findingsTable(r.compliance?.findings || r.findings?.findings, locale, riskFilter),
    summary: summaryPanel(r, locale),
    laws: SECTION_HTML.research(r.research || {}, locale)
  };
  // 各書狀分頁：以 type 對應後端 result.documents；缺件時顯示未產生提示；doc-revised 為合約模式的修訂條款版面（M1 僅顯示未產生提示）
  for (const k of TABS) {
    if (k === 'doc-revised') { panels[k] = renderRevised(r.revised, locale); continue; }
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
