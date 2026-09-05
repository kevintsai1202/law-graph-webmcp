import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStats, visibleWindow } from '../src/main/resources/static/js/views/stats.js';

// 用途：統計頁只呈現彙總數字（今日卡、SVG 圖表、折疊的倒序明細表），且不外洩任何可辨識個人的欄位。
const mk = (day, total, extra = {}) => ({ day, total, byMode: { case: total, contract: 0 }, byIdentity: { anonymous: total, member: 0 }, completed: total, failed: 0, promptTokens: total * 1000, completionTokens: total * 200, totalTokens: total * 1200, ...extra });
const data = { from: '2026-09-03', to: '2026-09-05', store: 'jdbc', members: { total: 12, activeToday: 3 },
  today: { day: '2026-09-05', total: 3, byMode: { case: 2, contract: 1 }, byIdentity: { anonymous: 2, member: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 },
  days: [ mk('2026-09-03', 0), mk('2026-09-04', 6), { ...mk('2026-09-05', 3), byMode: { case: 2, contract: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 } ] };

test('統計頁：今日卡、明細倒序、SVG 直條圖以最大值為峰', () => {
  const html = renderStats(data, 'zh-TW');
  assert.match(html, /id="stats-today"/);
  assert.match(html, /1,200|1200/);
  const rows = [...html.matchAll(/<tr data-day="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['2026-09-05', '2026-09-04', '2026-09-03']);
  // 直條圖：最大值那天的長條帶 data-peak，且長條為 SVG rect（不再是 CSS 寬度百分比）
  assert.match(html, /<svg[^>]*class="chart/);
  assert.match(html, /<rect[^>]*data-day="2026-09-04"[^>]*data-peak/);
  // 明細表放進可折疊 details，預設收合
  assert.match(html, /<details class="stats-details">/);
  assert.match(html, /12/);
  assert.doesNotMatch(html, /identityHash|@/);
  assert.match(renderStats(null, 'zh-TW'), /載入中/);
  assert.match(renderStats({ error: 'x' }, 'en'), /could not be loaded/i);
});

test('統計頁：環圈圖呈現能力占比與完成率', () => {
  const html = renderStats(data, 'zh-TW');
  assert.match(html, /class="donut"/);
  // 區間內案件 8 合約 1 → 案件 89%；完成 8 失敗 1 → 89%
  assert.match(html, /89%/);
});

test('visibleWindow：裁掉最前面沒資料的日子，但至少保留 7 天', () => {
  const days = Array.from({ length: 30 }, (_, i) => mk(`2026-08-${String(i + 1).padStart(2, '0')}`, i >= 28 ? 1 : 0));
  const win = visibleWindow(days);
  assert.equal(win.length, 7);
  assert.equal(win[0].day, '2026-08-24');
  // 首次有資料在 10 天前 → 顯示 10 天
  const days2 = Array.from({ length: 30 }, (_, i) => mk(`2026-08-${String(i + 1).padStart(2, '0')}`, i >= 20 ? 2 : 0));
  assert.equal(visibleWindow(days2).length, 10);
  // 全無資料 → 仍顯示最後 7 天；亂序輸入會先排序
  assert.equal(visibleWindow(days.map((d) => ({ ...d, total: 0, totalTokens: 0 })).reverse()).length, 7);
});

// 用途：members 統計不可得時後端回 -1，前端須顯示破折號而非「-1」
test('統計頁：members 為 -1 時顯示破折號', () => {
  const html = renderStats({ ...data, members: { total: -1, activeToday: -1 } }, 'zh-TW');
  assert.doesNotMatch(html, /-1/);
  assert.match(html, /—/);
});
