import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStats } from '../src/main/resources/static/js/views/stats.js';

// 用途：統計頁只呈現彙總數字（今日卡、倒序表格、長條圖），且不外洩任何可辨識個人的欄位。
const data = { from: '2026-09-03', to: '2026-09-05', store: 'jdbc', members: { total: 12, activeToday: 3 },
  today: { day: '2026-09-05', total: 3, byMode: { case: 2, contract: 1 }, byIdentity: { anonymous: 2, member: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 },
  days: [ { day: '2026-09-03', total: 0, byMode: { case: 0, contract: 0 }, byIdentity: { anonymous: 0, member: 0 }, completed: 0, failed: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          { day: '2026-09-04', total: 6, byMode: { case: 6, contract: 0 }, byIdentity: { anonymous: 6, member: 0 }, completed: 6, failed: 0, promptTokens: 4000, completionTokens: 800, totalTokens: 4800 },
          { day: '2026-09-05', total: 3, byMode: { case: 2, contract: 1 }, byIdentity: { anonymous: 2, member: 1 }, completed: 2, failed: 1, promptTokens: 1000, completionTokens: 200, totalTokens: 1200 } ] };

test('統計頁：今日卡、表格倒序、長條寬度依最大值', () => {
  const html = renderStats(data, 'zh-TW');
  assert.match(html, /id="stats-today"/);
  assert.match(html, /1,200|1200/);
  const rows = [...html.matchAll(/<tr data-day="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['2026-09-05', '2026-09-04', '2026-09-03']);
  assert.match(html, /class="bar" style="width:100%"[^>]*aria-label="2026-09-04[^"]*6/);
  assert.match(html, /12/);
  assert.doesNotMatch(html, /identityHash|@/);
  assert.match(renderStats(null, 'zh-TW'), /載入中/);
  assert.match(renderStats({ error: 'x' }, 'en'), /could not be loaded/i);
});
