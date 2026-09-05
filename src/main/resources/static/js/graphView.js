/**
 * law-powers 3D 渲染器的模組化包裝：可重複 render、可程式化 focus／filter／explainEdge／summary，
 * 供 UI 與 WebMCP 工具共用。全域 THREE、SpriteText、ForceGraph3D 由 vendor script 提供。
 * 純函式（toGraphData／findNode／neighborsOf／summarize）不碰 DOM，可在 node 測試。
 * 來源：skills/law-powers/skills/legal-graph/renderer/index.html（scripts/extract-renderer.mjs 抽出），
 * 配色、幾何體、連線樣式、詳情面板與篩選邏輯沿用原作；改動為模組化、延遲取 DOM、移除 load 自動渲染。
 */

import { t } from './i18n.js';

/** 目前顯示語系；由 app 透過 setLocale 同步，影響篩選器群組名與詳情面板文案。 */
let locale = 'en';
/** 設定圖區文案語系（'en' | 'zh-TW'）。 */
export function setLocale(code) { locale = code === 'zh-TW' ? 'zh-TW' : 'en'; }
/** 節點群組的顯示名稱（依語系）；未知群組回原字串。 */
export function groupName(group, code = locale) { const v = t('graph.group.' + group, code); return v === 'graph.group.' + group ? group : v; }

/* ────────────────────────────── 純函式 ────────────────────────────── */

/** superset JSON → 3d-force-graph {nodes, links}；edges.from/to → source/target，端點不存在的邊略過。 */
export function toGraphData(data) {
  const nodes = (data.nodes || []).map((n) => ({ ...n }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = (data.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, label: e.label, title: e.title, rel: e.rel }));
  return { nodes, links };
}

/** 以 id 精確或 label 子字串尋找節點；找不到回 null。 */
export function findNode(nodes, idOrLabel) {
  if (!idOrLabel) return null;
  return nodes.find((n) => n.id === idOrLabel) || nodes.find((n) => (n.label || '').includes(idOrLabel)) || null;
}

/** 連線端點可能是 id 字串或已解析的節點物件，統一取 id。 */
const endId = (x) => (x && typeof x === 'object' ? x.id : x);

/** 相鄰節點 id（不含自己）。 */
export function neighborsOf(links, nodeId) {
  const out = new Set();
  links.forEach((l) => {
    if (endId(l.source) === nodeId) out.add(endId(l.target));
    if (endId(l.target) === nodeId) out.add(endId(l.source));
  });
  return [...out];
}

/** 給 Agent 的摘要：群組計數、邊數、爭點、未該當／不明要件。 */
export function summarize(data) {
  const nodeCounts = {};
  (data.nodes || []).forEach((n) => { nodeCounts[n.group] = (nodeCounts[n.group] || 0) + 1; });
  return {
    nodeCounts,
    edgeCounts: (data.edges || []).length,
    topIssues: (data.nodes || []).filter((n) => n.group === 'issue').map((n) => n.label).slice(0, 10),
    unmetElements: (data.nodes || []).filter((n) => n.group === 'element' && n.met !== 'yes').map((n) => n.label)
  };
}

/** 偵測執行環境是否支援 WebGL（3D 渲染前提）。 */
export function isWebglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/* ────────────────────────────── 配色與樣式（沿用 law-powers） ────────────────────────────── */

/** superset 配色常數；judgment 為詳情面板標籤底色（節點本體依 status 由 judgmentColor 決定）。 */
const COLORS = {
  fact: '#f97316', law: '#0ea5e9', issue: '#a855f7', party: '#a16207', plaintiff: '#0d9488', judgment: '#22c55e',
  good: '#22c55e', bad: '#ef4444', mixed: '#eab308', strong: '#22c55e', weak: '#ef4444',
  edgeDefault: '#94a3b8', appeal: '#3b82f6', minfu: '#d946ef', joint: '#10b981', defense: '#ef4444', preserve: '#eab308',
  lawrel_trigger: '#3b82f6', lawrel_alt: '#eab308', lawrel_absorb: '#a855f7', lawrel_lex: '#0d9488', lawrel_bridge: '#ef4444',
  contract: '#6366f1', clause: '#64748b', obligation: '#f43f5e',
  risk_high: '#ef4444', risk_medium: '#eab308', risk_low: '#22c55e',
  include: '#94a3b8', impose: '#a855f7', bear: '#f97316', claim: '#0d9488', consideration: '#eab308', breach: '#ef4444',
  element: '#64748b', met_yes: '#22c55e', met_no: '#ef4444', met_unknown: '#eab308',
  elemref: '#38bdf8'
};

/** element 節點依 met 配色（yes 綠／no 紅／unknown 黃），未標註採中性藍灰。 */
function metColor(n) {
  return n.met === 'yes' ? COLORS.met_yes : n.met === 'no' ? COLORS.met_no : n.met === 'unknown' ? COLORS.met_unknown : COLORS.element;
}
/** clause 節點依 risk 配色（high 紅／medium 黃／low 綠）。 */
function riskColor(n) {
  return n.risk === 'high' ? COLORS.risk_high : n.risk === 'medium' ? COLORS.risk_medium : n.risk === 'low' ? COLORS.risk_low : COLORS.clause;
}
/** judgment 依 status 配色；無 status 視為 good。 */
function judgmentColor(n) { return n.status === 'bad' ? COLORS.bad : n.status === 'mixed' ? COLORS.mixed : COLORS.good; }

/** 依 group／status／favorable 決定節點幾何體與顏色；判決／契約帶重點標籤，法條／條款／要件帶小字標籤。 */
function nodeObject(n) {
  let geo, color;
  switch (n.group) {
    case 'fact': geo = new THREE.SphereGeometry(5); color = COLORS.fact; break;
    case 'law': geo = new THREE.BoxGeometry(7, 7, 7); color = COLORS.law; break;
    case 'judgment': geo = new THREE.SphereGeometry(5.5); color = judgmentColor(n); break;
    case 'issue': geo = new THREE.OctahedronGeometry(5.5); color = COLORS.issue; break;
    case 'party': geo = new THREE.OctahedronGeometry(5); color = COLORS.party; break;
    case 'plaintiff': geo = new THREE.TetrahedronGeometry(5.5); color = COLORS.plaintiff; break;
    case 'evidence': geo = new THREE.SphereGeometry(2.5);
      color = n.favorable === 'strong' ? COLORS.strong : n.favorable === 'weak' ? COLORS.weak : COLORS.edgeDefault; break;
    case 'contract': geo = new THREE.DodecahedronGeometry(7); color = COLORS.contract; break;
    case 'clause': geo = new THREE.BoxGeometry(5.5, 5.5, 5.5); color = riskColor(n); break;
    case 'obligation': {
      const s = n.duty === 'main' ? 1 : n.duty === 'collateral' ? 0.8 : n.duty === 'incidental' ? 0.65 : 0.8;
      geo = new THREE.CylinderGeometry(4 * s, 4 * s, 8 * s); color = COLORS.obligation; break;
    }
    case 'element': geo = new THREE.IcosahedronGeometry(4); color = metColor(n); break;
    default: geo = new THREE.SphereGeometry(4); color = COLORS.edgeDefault;
  }
  const mat = new THREE.MeshLambertMaterial({ color });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));
  if (n.overturned === true) {
    mat.color.set('#6b7280');
    group.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: '#ef4444', wireframe: true })));
  }
  const bigLabel = (text, y) => { const l = new SpriteText(text); l.color = '#ffffff'; l.backgroundColor = 'rgba(15,23,42,0.82)'; l.textHeight = 7; l.padding = 2; l.position.set(0, y, 0); return l; };
  const smallLabel = (text, color, height, y) => { const l = new SpriteText(text); l.color = color; l.textHeight = height; l.position.set(0, y, 0); return l; };
  if (n.group === 'judgment') group.add(bigLabel((n.label || '') + (n.overturned === true ? t('graph.overturned', locale) : ''), 12));
  else if (n.group === 'contract') group.add(bigLabel(n.label || '', 13));
  else if (n.group === 'law') group.add(smallLabel(n.label || '', LABEL_SUB, 3.4, 9));
  else if (n.group === 'clause') group.add(smallLabel(n.label || '', n.risk ? riskColor(n) : LABEL_SUB, 3.4, 9));
  else if (n.group === 'element') {
    const mark = n.met === 'yes' ? '○ ' : n.met === 'no' ? '✗ ' : n.met === 'unknown' ? '△ ' : '';
    group.add(smallLabel(mark + (n.label || ''), n.met ? metColor(n) : LABEL_SUB, 3.2, 8));
  }
  return group;
}

/** 依連線 label（＋rel）回傳 {color, width, curve, arrow}。 */
function linkStyle(l) {
  switch (l.label) {
    case '上訴': case '上訴/發回更審': return { color: COLORS.appeal, width: 2.2, curve: 0, arrow: 3.5 };
    case '刑事附帶民事 (民附)': case '刑事附帶民事': case '民附': return { color: COLORS.minfu, width: 1.6, curve: 0, arrow: 3.5 };
    case '連帶責任/保證': case '連帶責任': case '連帶': return { color: COLORS.joint, width: 1.8, curve: 0, arrow: 0 };
    case '抗辯/阻斷': case '抗辯': return { color: COLORS.defense, width: 1.6, curve: 0, arrow: 3.5 };
    case '保全/假扣押': case '保全': case '假扣押': return { color: COLORS.preserve, width: 1.4, curve: 0, arrow: 3.5 };
    case '法條關聯': return { color: COLORS['lawrel_' + (l.rel || 'trigger')] || COLORS.appeal, width: 1.4, curve: 0.25, arrow: 3 };
    case '當事人': return { color: COLORS.party, width: 1, curve: 0, arrow: 0 };
    case '證據': return { color: COLORS.edgeDefault, width: 0.8, curve: 0, arrow: 0 };
    case '包含': return { color: COLORS.include, width: 1.2, curve: 0, arrow: 3 };
    case '課予': return { color: COLORS.impose, width: 1.4, curve: 0, arrow: 3 };
    case '負擔': return { color: COLORS.bear, width: 1.8, curve: 0, arrow: 3.5 };
    case '得請求': return { color: COLORS.claim, width: 1.8, curve: 0, arrow: 3.5 };
    case '對價': return { color: COLORS.consideration, width: 2, curve: 0.3, arrow: 0 };
    case '違約效果': return { color: COLORS.breach, width: 1.6, curve: 0.15, arrow: 3.5 };
    case '要件': return { color: COLORS.law, width: 1.2, curve: 0, arrow: 3 };
    case '該當': return { color: COLORS.edgeDefault, width: 1.6, curve: 0, arrow: 3.5 };
    case '要件認定': return { color: COLORS.elemref, width: 1.3, curve: 0.2, arrow: 3 };
    default: return { color: COLORS.edgeDefault, width: 1.2, curve: 0, arrow: 3 };
  }
}

/** 連線顏色：證據依 target 的 favorable、該當依 target 的 met、要件認定依 stance，其餘沿用 linkStyle。 */
function linkColorFn(l) {
  const target = typeof l.target === 'object' ? l.target : null;
  if (l.label === '證據') return target ? (target.favorable === 'weak' ? COLORS.weak : target.favorable === 'strong' ? COLORS.strong : COLORS.edgeDefault) : COLORS.edgeDefault;
  if (l.label === '該當') return target ? metColor(target) : COLORS.edgeDefault;
  if (l.label === '要件認定') return l.stance === 'pro' ? COLORS.met_yes : l.stance === 'con' ? COLORS.met_no : COLORS.elemref;
  return linkStyle(l).color;
}

/** 3D 畫布底色：明亮主題，與 app.css 的 --canvas-bg 一致。 */
const CANVAS_BG = '#f6f3ec';
/** 次要標籤（法條／條款／要件未標註時）字色：明亮底改深藍灰。 */
const LABEL_SUB = '#475569';

/** 連線目標距離：證據貼近判決、契約與涵攝叢集內縮，其餘拉長紓解擁擠。 */
const LINK_DISTANCE = { '證據': 26, '當事人': 60, '包含': 45, '課予': 40, '負擔': 55, '得請求': 55, '要件': 40, '該當': 55 };

/**
 * 力導向版面參數。chargeStrength 越接近 0 節點越緊；chargeDistanceMax 讓排斥力只在近距離作用，
 * 沒有邊相連的節點才不會被一路推到畫面邊緣；isolatedGravity 再把孤立節點拉回中心附近；
 * warmupTicks 讓第一幀前先跑過幾十個 tick，開圖就是展開的版面。
 */
export const LAYOUT = { chargeStrength: -55, chargeDistanceMax: 150, isolatedGravity: 0.06, warmupTicks: 60 };

/**
 * 自訂 d3 force：只對沒有任何邊的孤立節點施加向原點的拉力。
 * 3d-force-graph 的 d3Force(name, force) 接受任何帶 initialize 的函式；連線資訊由 render 透過 links() 傳入。
 */
export function isolatedGravity(strength = LAYOUT.isolatedGravity) {
  /** 目前參與模擬的節點。 */
  let nodes = [];
  /** 至少有一條邊的節點 id。 */
  let linked = new Set();
  const force = (alpha) => {
    const k = strength * alpha;
    nodes.forEach((n) => {
      if (linked.has(n.id)) return;
      n.vx -= (n.x || 0) * k;
      n.vy -= (n.y || 0) * k;
      n.vz -= (n.z || 0) * k;
    });
  };
  // d3 simulation.force(name, force) 會以 (nodes, random) 呼叫 initialize，第二參數不是連線，連線另由 links() 設定。
  force.initialize = (simNodes) => { nodes = simNodes; };
  /** 設定連線資料以判定孤立節點（render 於 graphData 設定後呼叫）。 */
  force.links = (links = []) => {
    linked = new Set();
    links.forEach((l) => { linked.add(endId(l.source)); linked.add(endId(l.target)); });
    return force;
  };
  return force;
}

/* ────────────────────────────── 模組狀態 ────────────────────────────── */

/** 3d-force-graph 實例；尚未 render 為 null。 */
let Graph = null;
/** 最近一次 render 的原始 superset 資料（summary 用）。 */
let current = null;
/** 群組可見度：{ group: boolean }。 */
let filterState = {};
/** 目前聚焦的案件家族；null 為全部。 */
let activeFamily = null;
/** 初次自動框圖只做一次，避免互動後鏡頭被重置。 */
let initialFitDone = false;
/** 容器尺寸監聽，重新 render 時先解除。 */
let resizeObserver = null;

/** 延遲取 DOM：result view 每次重繪都會重建這些元素。 */
const $ = (id) => document.getElementById(id);

/* ────────────────────────────── 詳情面板 ────────────────────────────── */

/** status → 勝負／有利性徽章文字；節點自訂 statusText 優先。 */
function badgeText(n) {
  if (n.statusText) return n.statusText;
  return ['good', 'bad', 'mixed'].includes(n.status) ? t('graph.status.' + n.status, locale) : '';
}
/** 建立圓角徽章元素。 */
function pill(text, color) {
  const b = document.createElement('div');
  b.textContent = text;
  b.style.cssText = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:600;color:#fff;margin-bottom:6px;background:' + color + ';';
  return b;
}
/** 判決勝負徽章；無 status 回 null。 */
function buildStatusBadge(n) {
  const text = badgeText(n); if (!text) return null;
  return pill(text, n.status === 'good' ? COLORS.good : n.status === 'bad' ? COLORS.bad : COLORS.mixed);
}
/** 條款風險徽章；無 risk 回 null。 */
function buildRiskBadge(risk) {
  const map = { high: t('graph.risk.high', locale), medium: t('graph.risk.medium', locale), low: t('graph.risk.low', locale) };
  return map[risk] ? pill(map[risk], risk === 'high' ? COLORS.risk_high : risk === 'medium' ? COLORS.risk_medium : COLORS.risk_low) : null;
}
/** 要件該當性徽章；無 met 回 null。 */
function buildMetBadge(met) {
  const map = { yes: t('graph.met.yes', locale), no: t('graph.met.no', locale), unknown: t('graph.met.unknown', locale) };
  return map[met] ? pill(map[met], met === 'yes' ? COLORS.met_yes : met === 'no' ? COLORS.met_no : COLORS.met_unknown) : null;
}
/** 義務類型顯示文字。 */
function dutyText(duty) { return ['main', 'collateral', 'incidental'].includes(duty) ? t('graph.duty.' + duty, locale) : ''; }
/** 小型資訊列（義務類型／契約地位）。 */
function infoLine(text) {
  const d = document.createElement('div');
  d.textContent = text; d.style.cssText = 'font-size:0.85rem;color:var(--color-primary);margin-bottom:6px;';
  return d;
}
/** 證據節點清單用文字：泛稱 label 改用 description。 */
function evidenceText(e) {
  const generic = !e.label || e.label === '有利證據' || e.label === '不利證據';
  return generic ? (e.description || e.title || '') : e.label;
}
/** 彙整判決節點所連的證據，建立「關鍵證據優劣點」清單。 */
function buildEvidenceList(n) {
  if (!Graph) return null;
  const evs = Graph.graphData().links
    .filter((l) => l.label === '證據' && endId(l.source) === n.id)
    .map((l) => (typeof l.target === 'object' ? l.target : null)).filter(Boolean);
  const sec = document.createElement('div'); sec.style.cssText = 'margin-top:16px;';
  const h = document.createElement('h3'); h.textContent = t('graph.detail.evidence', locale); h.style.cssText = 'font-size:0.95rem;color:var(--color-heading);margin-bottom:8px;';
  sec.appendChild(h);
  if (!evs.length) {
    const p = document.createElement('div'); p.textContent = t('graph.detail.noEvidence', locale); p.style.cssText = 'color:var(--text-sub);font-size:0.85rem;';
    sec.appendChild(p); return sec;
  }
  const ul = document.createElement('ul'); ul.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;';
  evs.forEach((e) => {
    const strong = e.favorable === 'strong';
    const li = document.createElement('li'); li.style.cssText = 'display:flex;gap:8px;font-size:0.85rem;line-height:1.5;color:var(--color-text);';
    const dot = document.createElement('span'); dot.style.cssText = 'flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:5px;background:' + (strong ? COLORS.strong : COLORS.weak) + ';';
    const txt = document.createElement('span'); const lead = document.createElement('b'); lead.textContent = t(strong ? 'graph.detail.forDefendant' : 'graph.detail.againstDefendant', locale);
    txt.appendChild(lead); txt.appendChild(document.createTextNode(evidenceText(e)));
    li.appendChild(dot); li.appendChild(txt); ul.appendChild(li);
  });
  sec.appendChild(ul); return sec;
}
/** 以安全 DOM 呈現含 **粗體** 與換行的描述文字。 */
function renderRichText(container, text) {
  container.style.cssText = 'font-size:0.9rem;line-height:1.6;color:var(--color-text);white-space:pre-wrap;';
  const lines = String(text).split('\n');
  lines.forEach((line, i) => {
    line.split(/(\*\*[^*]+\*\*)/g).forEach((p) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) { const b = document.createElement('b'); b.textContent = p.slice(2, -2); container.appendChild(b); }
      else if (p) container.appendChild(document.createTextNode(p));
    });
    if (i < lines.length - 1) container.appendChild(document.createElement('br'));
  });
}
/** 顯示右側詳情面板：標籤底色依 group，徽章依節點類型，描述以安全 DOM 呈現，有 url 附全文連結。 */
function showDetail(n) {
  const panel = $('detail-panel'), tag = $('detail-tag'), title = $('detail-title'), body = $('detail-body');
  if (!panel || !tag || !title || !body) return;
  tag.textContent = (n.group || '').toUpperCase();
  tag.style.background = COLORS[n.group] || COLORS.edgeDefault;
  title.textContent = n.label || '';
  body.replaceChildren();
  const add = (el) => el && body.appendChild(el);
  if (n.group === 'judgment') add(buildStatusBadge(n));
  if (n.group === 'clause') add(buildRiskBadge(n.risk));
  if (n.group === 'element') add(buildMetBadge(n.met));
  if (n.group === 'obligation' && dutyText(n.duty)) add(infoLine(t('graph.detail.dutyType', locale) + dutyText(n.duty)));
  if (n.group === 'party' && n.role) add(infoLine(t('graph.detail.role', locale) + n.role));
  const bodyText = n.description || n.title || '';
  if (bodyText) { const el = document.createElement('div'); renderRichText(el, bodyText); add(el); }
  if (n.group === 'judgment') add(buildEvidenceList(n));
  if (n.url) {
    const link = document.createElement('a');
    link.href = n.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = t('graph.detail.fullText', locale);
    link.style.cssText = 'display:inline-block;margin-top:12px;min-height:44px;line-height:44px;color:var(--color-primary);font-weight:600;text-decoration:none;';
    add(link);
  }
  panel.classList.add('active');
}
/** 關閉詳情面板。 */
function hideDetail() { $('detail-panel')?.classList.remove('active'); }

/* ────────────────────────────── 篩選、家族聚焦、搜尋 ────────────────────────────── */

/** 節點可見度：未勾選的 group 隱藏。 */
function nodeVis(n) { return filterState[n.group] !== false; }
/** 連線可見度：兩端節點所屬 group 皆需可見。 */
function linkVis(l) {
  const s = typeof l.source === 'object' ? l.source : null, t = typeof l.target === 'object' ? l.target : null;
  return (!s || filterState[s.group] !== false) && (!t || filterState[t.group] !== false);
}
/** 依目前圖上出現的 group 動態產生篩選 checkbox。 */
function buildFilters(nodes) {
  const box = $('filter-box'); if (!box) return;
  box.replaceChildren();
  filterState = {};
  [...new Set(nodes.map((n) => n.group))].forEach((g) => {
    filterState[g] = true;
    const lb = document.createElement('label');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.dataset.group = g;
    cb.addEventListener('change', () => { filterState[g] = cb.checked; Graph.nodeVisibility(nodeVis).linkVisibility(linkVis); });
    lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + groupName(g))); box.appendChild(lb);
  });
  // 契約圖：附風險色說明（只在有 clause 節點時）
  if (nodes.some((n) => n.group === 'clause')) {
    const legend = document.createElement('div');
    legend.className = 'legend-risks';
    ['high', 'medium', 'low'].forEach((r) => {
      const span = document.createElement('span');
      span.className = 'legend-risk risk-' + r;
      span.textContent = t('graph.risk.' + r, locale);
      legend.appendChild(span);
    });
    box.appendChild(legend);
  }
  Graph.nodeVisibility(nodeVis).linkVisibility(linkVis);
}
/** 讓篩選器 checkbox 與 filterState 同步（程式化 filter 後呼叫）。 */
function syncFilterCheckboxes() {
  document.querySelectorAll('#filter-box input[type=checkbox]').forEach((cb) => { cb.checked = filterState[cb.dataset.group] !== false; });
}
/** 依節點 family 欄位動態產生家族 chip；無 family 時隱藏整區。 */
function buildFamilyFocus(nodes) {
  const box = $('family-box'); if (!box) return;
  box.replaceChildren();
  const fams = [...new Set(nodes.map((n) => n.family).filter(Boolean))];
  if (!fams.length) { box.style.display = 'none'; return; }
  box.style.display = '';
  fams.forEach((f) => {
    const chip = document.createElement('span'); chip.textContent = f;
    chip.style.cssText = 'display:inline-block;font-size:0.8rem;padding:6px 12px;margin:2px;border:1px solid var(--color-border);border-radius:999px;cursor:pointer;color:var(--color-text-sub);background:var(--color-surface);';
    chip.setAttribute('role', 'button'); chip.tabIndex = 0;
    chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); } });
    chip.addEventListener('click', () => { activeFamily = activeFamily === f ? null : f; applyFamilyFocus(); });
    box.appendChild(chip);
  });
}
/** 依 activeFamily 調整節點透明度：非聚焦家族淡化至 0.12。 */
function applyFamilyFocus() {
  if (!Graph) return;
  Graph.nodeThreeObject((n) => {
    const obj = nodeObject(n); const inFam = !activeFamily || n.family === activeFamily;
    obj.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = inFam ? 1 : 0.12; } });
    return obj;
  });
}
/** 搜尋框 Enter → focus(kw)。 */
function bindSearch() {
  const input = $('search-input'); if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const kw = e.target.value.trim(); if (kw) focus(kw);
  });
}
/** 畫布區顯示錯誤橫幅（取代靜默失敗）。 */
function showCanvasError(title, tips) {
  const el = $('network-canvas'); if (!el) return;
  el.replaceChildren();
  const box = document.createElement('div');
  box.style.cssText = 'max-width:560px;margin:80px auto;padding:24px 28px;background:var(--color-bad-soft);border:1px solid var(--color-bad);border-radius:12px;color:var(--color-text);font-size:0.95rem;line-height:1.8;';
  const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'font-size:1.1rem;font-weight:700;margin-bottom:10px;color:var(--color-bad);';
  box.appendChild(h);
  const ul = document.createElement('ul'); ul.style.cssText = 'padding-left:1.2em;margin:0;';
  tips.forEach((tip) => { const li = document.createElement('li'); li.textContent = tip; ul.appendChild(li); });
  box.appendChild(ul); el.appendChild(box);
}

/* ────────────────────────────── 對外 API ────────────────────────────── */

/** 渲染（可重複呼叫）：清空 #network-canvas 後重建；回傳 Graph 實例，無 WebGL 時回 null。 */
export function render(data) {
  current = data;
  const el = $('network-canvas'); if (!el) return null;
  el.replaceChildren();
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  if (!isWebglAvailable()) {
    showCanvasError('WebGL is not available in this browser', [
      'Open the page in Chrome/Edge/Firefox with hardware acceleration enabled.',
      'Remote desktops and IDE preview browsers often disable WebGL.']);
    Graph = null; return null;
  }
  initialFitDone = false; activeFamily = null;
  Graph = ForceGraph3D()(el)
    .backgroundColor(CANVAS_BG)
    .graphData(toGraphData(data))
    .nodeThreeObject(nodeObject).nodeThreeObjectExtend(false)
    .linkColor(linkColorFn)
    .linkWidth((l) => linkStyle(l).width)
    .linkCurvature((l) => linkStyle(l).curve)
    .linkDirectionalArrowLength((l) => linkStyle(l).arrow)
    .linkDirectionalArrowRelPos(1)
    .linkOpacity(0.6)
    // 先在背景跑一段 tick 再畫第一幀，避免初始畫面所有節點疊在原點
    .warmupTicks(LAYOUT.warmupTicks)
    .onEngineStop(() => { if (!initialFitDone) { initialFitDone = true; Graph.zoomToFit(600, 60); } });
  // force 設定須在 graphData 之後、且不可同步 d3ReheatSimulation（layout 尚未建立會拋 'tick'）
  Graph.d3Force('charge').strength(LAYOUT.chargeStrength).distanceMax(LAYOUT.chargeDistanceMax);
  Graph.d3Force('link').distance((l) => LINK_DISTANCE[l.label] ?? 80);
  // 孤立節點（例如尚無證據支撐的獨立事實）拉回中心，避免散落在畫面四角
  const gathered = Graph.graphData();
  Graph.d3Force('isolatedGravity', isolatedGravity());
  Graph.d3Force('isolatedGravity').links(gathered.links);
  // 套件用非同步方式建立 layout；setTimeout(0) 仍可能搶先把 engineRunning 設為 true，
  // 下一個影格便對尚未建立的 layout 呼叫 tick。等第一次有效 tick 才重新加熱。
  let reheated = false;
  const renderedGraph = Graph;
  renderedGraph.onEngineTick(() => {
    if (reheated) return;
    reheated = true;
    renderedGraph.d3ReheatSimulation();
  });
  const syncSize = () => Graph.width(el.clientWidth).height(el.clientHeight);
  syncSize();
  resizeObserver = new ResizeObserver(syncSize); resizeObserver.observe(el);
  Graph.onNodeClick((n) => showDetail(n));
  Graph.onNodeHover((n) => { const c = el.querySelector('canvas'); if (c) c.style.cursor = n ? 'pointer' : 'grab'; });
  $('close-panel-btn')?.addEventListener('click', hideDetail);
  buildFilters(Graph.graphData().nodes);
  buildFamilyFocus(Graph.graphData().nodes);
  bindSearch();
  return Graph;
}

/** 去掉 3d-force-graph 附加的座標與 three 物件，回傳可序列化的節點。 */
const strip = ({ x, y, z, vx, vy, vz, fx, fy, fz, __threeObj, ...rest }) => rest;

/** 鏡頭飛到節點並開詳情面板；回 { node, neighbors } 或 null。 */
export function focus(idOrLabel) {
  if (!Graph) return null;
  const { nodes, links } = Graph.graphData();
  const hit = findNode(nodes, idOrLabel); if (!hit) return null;
  const dist = 60, x = hit.x || 0, y = hit.y || 0, z = hit.z || 0, r = Math.hypot(x, y, z) || 1;
  Graph.cameraPosition({ x: x * (1 + dist / r), y: y * (1 + dist / r), z: z * (1 + dist / r) }, hit, 1200);
  showDetail(hit);
  return { node: strip(hit), neighbors: neighborsOf(links, hit.id).map((id) => strip(nodes.find((n) => n.id === id))) };
}

/** 群組可見度／家族聚焦；reset 還原全部。回 { visibleNodes, visibleEdges } 或 null。 */
export function filter({ groups, family, reset } = {}) {
  if (!Graph) return null;
  const { nodes, links } = Graph.graphData();
  if (reset) { Object.keys(filterState).forEach((g) => { filterState[g] = true; }); activeFamily = null; }
  if (Array.isArray(groups)) Object.keys(filterState).forEach((g) => { filterState[g] = groups.includes(g); });
  if (family !== undefined) activeFamily = family;
  Graph.nodeVisibility(nodeVis).linkVisibility(linkVis);
  applyFamilyFocus();
  syncFilterCheckboxes();
  return { visibleNodes: nodes.filter(nodeVis).length, visibleEdges: links.filter(linkVis).length };
}

/** 解釋一條邊：{ label, rel, title, sourceLabel, targetLabel } 或 null。 */
export function explainEdge(sourceId, targetId) {
  if (!Graph) return null;
  const l = Graph.graphData().links.find((k) => endId(k.source) === sourceId && endId(k.target) === targetId);
  if (!l) return null;
  const { nodes } = Graph.graphData();
  const labelOf = (end) => (typeof end === 'object' ? end.label : nodes.find((n) => n.id === end)?.label);
  return { label: l.label, rel: l.rel, title: l.title, sourceLabel: labelOf(l.source), targetLabel: labelOf(l.target) };
}

/** 最近一次 render 資料的摘要；尚未 render 回 null。 */
export function summary() { return current ? summarize(current) : null; }
