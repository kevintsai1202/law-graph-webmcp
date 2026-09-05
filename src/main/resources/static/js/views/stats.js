import { esc } from './util.js';
import { t } from '../i18n.js';

/** 日期欄位防呆：缺值時回空字串，避免 slice／localeCompare 在殘缺資料上丟例外。 */
const day = (row) => String(row?.day || '');

/** 純 CSS 長條：寬度＝值／最大值；每條帶 aria-label 數值。 */
function bars(rows, pick, labelKey, locale) {
  const max = Math.max(1, ...rows.map(pick));
  // 不加 role="img"：讓每一條自己的 aria-label（日期＋數值）被讀出，而非整組被壓成一張圖
  return `<div class="bars" data-chart="${esc(t(labelKey, locale))}">${rows.map((r) => `<div class="bar-row"><span class="bar-day">${esc(day(r).slice(5))}</span><span class="bar" style="width:${Math.round(pick(r) / max * 100)}%" aria-label="${esc(day(r))} ${pick(r).toLocaleString(locale)}"></span><span class="bar-value">${pick(r).toLocaleString(locale)}</span></div>`).join('')}</div>`;
}

/**
 * 統計頁：data 為 /api/stats 回應、null（載入中）或 { error }。
 * 僅呈現彙總數字，不輸出任何可辨識個人的欄位。
 */
export function renderStats(data, locale) {
  if (!data) return `<section class="stats card"><p role="status">${esc(t('stats.loading', locale))}</p></section>`;
  if (data.error) return `<section class="stats card" role="alert"><p>${esc(t('stats.error', locale))}</p></section>`;
  // asc 供長條圖（左舊右新），desc 供表格（最新在上）
  const asc = [...(data.days || [])].sort((a, b) => day(a).localeCompare(day(b))), desc = [...asc].reverse(), today = data.today || desc[0] || {};
  const n = (v) => Number(v || 0).toLocaleString(locale);
  // 成員統計不可得時後端回 -1，顯示破折號而非誤導的負數
  const m = (v) => (Number(v) < 0 ? '—' : n(v));
  const tile = (title, big, sub) => `<div class="stat-tile"><span class="stat-title">${esc(title)}</span><strong class="stat-big">${esc(big)}</strong><span class="stat-sub">${esc(sub)}</span></div>`;
  const head = ['day', 'total', 'case', 'contract', 'completed', 'failed', 'prompt', 'completion', 'tokens'].map((k) => `<th scope="col">${esc(t('stats.col.' + k, locale))}</th>`).join('');
  const rows = desc.map((r) => `<tr data-day="${esc(day(r))}"><td>${esc(day(r))}</td><td>${n(r.total)}</td><td>${n(r.byMode?.case)}</td><td>${n(r.byMode?.contract)}</td><td>${n(r.completed)}</td><td>${n(r.failed)}</td><td>${n(r.promptTokens)}</td><td>${n(r.completionTokens)}</td><td>${n(r.totalTokens)}</td></tr>`).join('');
  return `<section class="stats"><h2>${esc(t('stats.title', locale))}</h2><p class="home-lead">${esc(t('stats.lead', locale))}</p>
    <div id="stats-today" class="stat-tiles">
      ${tile(t('stats.todayCases', locale), n(today.total), `${t('home.case.title', locale)} ${n(today.byMode?.case)} · ${t('home.contract.title', locale)} ${n(today.byMode?.contract)} · ${t('stats.anonymous', locale)} ${n(today.byIdentity?.anonymous)} · ${t('stats.member', locale)} ${n(today.byIdentity?.member)}`)}
      ${tile(t('stats.todayTokens', locale), n(today.totalTokens), `prompt ${n(today.promptTokens)} · completion ${n(today.completionTokens)}`)}
      ${tile(t('stats.members', locale), m(data.members?.total), `${t('stats.activeToday', locale)} ${m(data.members?.activeToday)}`)}
    </div>
    <div class="card"><h3>${esc(t('stats.chart.cases', locale))}</h3>${bars(asc, (r) => Number(r.total || 0), 'stats.chart.cases', locale)}</div>
    <div class="card"><h3>${esc(t('stats.chart.tokens', locale))}</h3>${bars(asc, (r) => Number(r.totalTokens || 0), 'stats.chart.tokens', locale)}</div>
    <div class="card table-wrap"><table class="assess-table stats-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
