import { esc } from './util.js';
import { t } from '../i18n.js';

/** 日期欄位防呆：缺值時回空字串，避免 slice／localeCompare 在殘缺資料上丟例外。 */
const day = (row) => String(row?.day || '');
/** 數值防呆：任何缺值都當 0。 */
const num = (v) => Number(v || 0);
/** 顯示區間下限：即使只有今天有資料，也至少畫最近 7 天讓趨勢有比較基準。 */
const MIN_DAYS = 7;

/**
 * 決定圖表要畫哪些日子：從「第一個有分析或 token 的日子」起到最新一天，但至少 MIN_DAYS 天。
 * 站台上線前的空白日期沒有資訊量，全部列出只會把真正的資料壓成一小段。
 * 回傳依日期遞增排序的陣列。
 */
export function visibleWindow(days) {
  const asc = [...(days || [])].sort((a, b) => day(a).localeCompare(day(b)));
  const first = asc.findIndex((r) => num(r.total) > 0 || num(r.totalTokens) > 0);
  const start = Math.max(0, Math.min(first < 0 ? asc.length : first, asc.length - MIN_DAYS));
  return asc.slice(start);
}

/** 版面常數：SVG 以 viewBox 縮放，數字是相對單位而非像素。 */
const W = 640, H = 200, PAD = { top: 12, right: 8, bottom: 28, left: 48 };
const PLOT_H = H - PAD.top - PAD.bottom, PLOT_W = W - PAD.left - PAD.right;

/**
 * 直條圖（可堆疊）：series 為 [{ pick, cls }]，同一天的各序列由下往上堆。
 * 最高的那天標 data-peak，供測試與 CSS 強調；每天一個 <g> 帶 aria-label 讀出日期與合計。
 */
function columnChart(rows, series, locale, title) {
  const totals = rows.map((r) => series.reduce((s, sr) => s + num(sr.pick(r)), 0));
  const max = Math.max(1, ...totals), peak = totals.indexOf(Math.max(...totals));
  const n = Math.max(1, rows.length), slot = PLOT_W / n, bw = Math.min(36, slot * 0.6);
  const y = (v) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  // 三條水平格線與刻度（0、50%、100%），用 toLocaleString 讓 token 千分位好讀
  const grid = [0, 0.5, 1].map((p) => `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(max * p).toFixed(1)}" y2="${y(max * p).toFixed(1)}"/><text class="tick" x="${PAD.left - 6}" y="${(y(max * p) + 4).toFixed(1)}" text-anchor="end">${esc(Math.round(max * p).toLocaleString(locale))}</text>`).join('');
  // 日期標籤：天數多時每隔幾天標一個以免重疊；最後一天一律標
  const every = Math.ceil(n / 10);
  const cols = rows.map((r, i) => {
    const x = PAD.left + slot * i + (slot - bw) / 2;
    let base = 0;
    const rects = series.map((sr) => {
      const v = num(sr.pick(r)); if (v <= 0) return '';
      const top = y(base + v), h = y(base) - top; base += v;
      return `<rect class="${sr.cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="2" data-day="${esc(day(r))}"${i === peak && totals[i] > 0 ? ' data-peak="1"' : ''}/>`;
    }).join('');
    const showLabel = i === n - 1 || (n - 1 - i) % every === 0;
    const label = showLabel ? `<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(day(r).slice(5))}</text>` : '';
    // 無資料的日子畫一個淡點，讓「這天是 0」與「沒這天」看得出差別
    const empty = totals[i] === 0 ? `<circle class="empty" cx="${(x + bw / 2).toFixed(1)}" cy="${(PAD.top + PLOT_H - 2).toFixed(1)}" r="1.6"/>` : '';
    return `<g aria-label="${esc(day(r))} ${totals[i].toLocaleString(locale)}">${rects}${empty}${label}</g>`;
  }).join('');
  return `<svg class="chart chart-columns" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">${grid}${cols}</svg>`;
}

/**
 * 環圈圖：parts 為 [{ label, value, cls }]，以 stroke-dasharray 依比例畫弧，中央顯示第一個 part 的比例。
 * 全為 0 時只畫灰底環並顯示「尚無資料」。
 */
function donut(parts, locale, emptyText) {
  const total = parts.reduce((s, p) => s + num(p.value), 0);
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = total <= 0 ? '' : parts.map((p) => {
    const len = (num(p.value) / total) * C;
    const seg = `<circle class="${p.cls}" r="${R}" cx="60" cy="60" fill="none" stroke-width="14" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += len; return seg;
  }).join('');
  const pct = total > 0 ? Math.round((num(parts[0].value) / total) * 100) + '%' : esc(emptyText);
  const legend = parts.map((p) => `<li><i class="swatch ${p.cls}"></i>${esc(p.label)}<b>${num(p.value).toLocaleString(locale)}</b></li>`).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${esc(parts.map((p) => `${p.label} ${num(p.value)}`).join(', '))}"><circle class="donut-track" r="${R}" cx="60" cy="60" fill="none" stroke-width="14"/>${arcs}<text class="donut-center${total > 0 ? '' : ' muted'}" x="60" y="60" text-anchor="middle" dominant-baseline="central">${pct}</text></svg><ul class="legend">${legend}</ul></div>`;
}

/** 與前一天相比的變化標籤（▲／▼／—），供今日數字卡使用。 */
function delta(cur, prev, locale) {
  const d = num(cur) - num(prev);
  if (d === 0) return `<span class="delta flat">— ${esc(t('stats.vsYesterday', locale))}</span>`;
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString(locale)} ${esc(t('stats.vsYesterday', locale))}</span>`;
}

/**
 * 統計頁：data 為 /api/stats 回應、null（載入中）或 { error }。
 * 僅呈現彙總數字，不輸出任何可辨識個人的欄位。
 * 版面：今日三卡（含相對昨日變化）→ 兩張趨勢直條圖 → 兩個環圈 → 可折疊每日明細表。
 */
export function renderStats(data, locale) {
  if (!data) return `<section class="stats card"><p role="status">${esc(t('stats.loading', locale))}</p></section>`;
  if (data.error) return `<section class="stats card" role="alert"><p>${esc(t('stats.error', locale))}</p></section>`;
  const win = visibleWindow(data.days), desc = [...win].reverse();
  const today = data.today || desc[0] || {}, yesterday = win.length >= 2 ? win[win.length - 2] : {};
  const n = (v) => num(v).toLocaleString(locale);
  // 成員統計不可得時後端回 -1，顯示破折號而非誤導的負數
  const m = (v) => (Number(v) < 0 ? '—' : n(v));
  const sum = (pick) => win.reduce((s, r) => s + num(pick(r)), 0);
  const tile = (title, big, sub, foot = '') => `<div class="stat-tile card"><span class="stat-title">${esc(title)}</span><strong class="stat-big">${esc(big)}</strong><span class="stat-sub">${esc(sub)}</span>${foot}</div>`;
  const period = win.length ? `${day(win[0])} ～ ${day(win[win.length - 1])}` : '';
  const caseT = t('home.case.title', locale), contractT = t('home.contract.title', locale);
  const head = ['day', 'total', 'case', 'contract', 'completed', 'failed', 'prompt', 'completion', 'tokens'].map((k) => `<th scope="col">${esc(t('stats.col.' + k, locale))}</th>`).join('');
  const rows = desc.map((r) => `<tr data-day="${esc(day(r))}"><td>${esc(day(r))}</td><td>${n(r.total)}</td><td>${n(r.byMode?.case)}</td><td>${n(r.byMode?.contract)}</td><td>${n(r.completed)}</td><td>${n(r.failed)}</td><td>${n(r.promptTokens)}</td><td>${n(r.completionTokens)}</td><td>${n(r.totalTokens)}</td></tr>`).join('');
  return `<section class="stats">
    <header class="stats-head"><div><h2>${esc(t('stats.title', locale))}</h2><p class="home-lead">${esc(t('stats.lead', locale))}</p></div>${period ? `<span class="period-chip">${esc(t('stats.period', locale))} ${esc(period)}</span>` : ''}</header>
    <div id="stats-today" class="stat-tiles">
      ${tile(t('stats.todayCases', locale), n(today.total), `${caseT} ${n(today.byMode?.case)} · ${contractT} ${n(today.byMode?.contract)} · ${t('stats.anonymous', locale)} ${n(today.byIdentity?.anonymous)} · ${t('stats.member', locale)} ${n(today.byIdentity?.member)}`, delta(today.total, yesterday.total, locale))}
      ${tile(t('stats.todayTokens', locale), n(today.totalTokens), `prompt ${n(today.promptTokens)} · completion ${n(today.completionTokens)}`, delta(today.totalTokens, yesterday.totalTokens, locale))}
      ${tile(t('stats.members', locale), m(data.members?.total), `${t('stats.activeToday', locale)} ${m(data.members?.activeToday)}`)}
    </div>
    <div class="stats-grid">
      <div class="card chart-card"><h3>${esc(t('stats.chart.cases', locale))}</h3>
        <ul class="legend inline"><li><i class="swatch s-case"></i>${esc(caseT)}</li><li><i class="swatch s-contract"></i>${esc(contractT)}</li></ul>
        ${columnChart(win, [{ pick: (r) => r.byMode?.case, cls: 's-case' }, { pick: (r) => r.byMode?.contract, cls: 's-contract' }], locale, t('stats.chart.cases', locale))}</div>
      <div class="card chart-card"><h3>${esc(t('stats.chart.tokens', locale))}</h3>
        <ul class="legend inline"><li><i class="swatch s-prompt"></i>prompt</li><li><i class="swatch s-completion"></i>completion</li></ul>
        ${columnChart(win, [{ pick: (r) => r.promptTokens, cls: 's-prompt' }, { pick: (r) => r.completionTokens, cls: 's-completion' }], locale, t('stats.chart.tokens', locale))}</div>
      <div class="card chart-card donut-card"><h3>${esc(t('stats.chart.mix', locale))}</h3>
        ${donut([{ label: caseT, value: sum((r) => r.byMode?.case), cls: 's-case' }, { label: contractT, value: sum((r) => r.byMode?.contract), cls: 's-contract' }], locale, t('stats.noData', locale))}</div>
      <div class="card chart-card donut-card"><h3>${esc(t('stats.chart.outcome', locale))}</h3>
        ${donut([{ label: t('stats.col.completed', locale), value: sum((r) => r.completed), cls: 's-ok' }, { label: t('stats.col.failed', locale), value: sum((r) => r.failed), cls: 's-bad' }], locale, t('stats.noData', locale))}</div>
    </div>
    <details class="stats-details"><summary>${esc(t('stats.details', locale))}</summary>
      <div class="card table-wrap"><table class="assess-table stats-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></details></section>`;
}
