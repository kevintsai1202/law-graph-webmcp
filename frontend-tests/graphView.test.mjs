import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGraphData, findNode, neighborsOf, summarize, groupName, setLocale, isolatedGravity, LAYOUT } from '../src/main/resources/static/js/graphView.js';

test('groupName 依語系顯示群組名稱；setLocale 影響預設語系', () => {
  assert.equal(groupName('fact', 'en'), 'Facts');
  assert.equal(groupName('fact', 'zh-TW'), '事實');
  assert.equal(groupName('mystery', 'en'), 'mystery');
  setLocale('zh-TW'); assert.equal(groupName('law'), '法條');
  setLocale('en'); assert.equal(groupName('law'), 'Statutes');
});

// 用途：graphView 中不碰 DOM／WebGL 的純函式，在 node 驗證資料轉換與摘要。
const data = { nodes: [
  { id: 'f1', group: 'fact', label: 'Crash' }, { id: 'l1', group: 'law', label: 'Civil Code Art. 184 ¶1（民法第184條第1項）' },
  { id: 'i1', group: 'issue', label: 'Negligence' }, { id: 'e1', group: 'element', label: 'Causation', met: 'unknown' }],
  edges: [{ from: 'f1', to: 'l1', label: '適用' }, { from: 'ghost', to: 'l1', label: '引用' }, { from: 'l1', to: 'e1', label: '要件', title: 'decomposed' }] };

test('isolatedGravity 只把沒有任何邊的孤立節點往原點拉，有連線的節點不受影響', () => {
  const g = toGraphData(data);
  const nodes = g.nodes.map((n) => ({ ...n, x: 100, y: -50, z: 20, vx: 0, vy: 0, vz: 0 }));
  const force = isolatedGravity(0.1);
  force.initialize(nodes, Math.random);
  force.links(g.links);
  force(1);
  const isolated = nodes.find((n) => n.id === 'i1');
  const linked = nodes.find((n) => n.id === 'l1');
  assert.ok(isolated.vx < 0 && isolated.vy > 0 && isolated.vz < 0, '孤立節點速度應指向原點');
  assert.deepEqual([linked.vx, linked.vy, linked.vz], [0, 0, 0]);
});
test('LAYOUT 參數：排斥力有限距、孤立節點有向心力', () => {
  assert.ok(LAYOUT.chargeStrength < 0 && LAYOUT.chargeStrength > -90, '排斥力應比原本 -90 弱');
  assert.ok(LAYOUT.chargeDistanceMax > 0 && LAYOUT.chargeDistanceMax <= 200, '排斥力需限距，避免無關節點被推到邊緣');
  assert.ok(LAYOUT.isolatedGravity > 0);
});
test('toGraphData 轉 from/to 為 source/target 並丟掉無效邊', () => {
  const g = toGraphData(data);
  assert.equal(g.links.length, 2);
  assert.deepEqual(g.links[0], { source: 'f1', target: 'l1', label: '適用', title: undefined, rel: undefined });
});
test('findNode 支援 id 與 label 子字串（含原文括號內）', () => {
  assert.equal(findNode(data.nodes, 'l1').id, 'l1');
  assert.equal(findNode(data.nodes, '民法第184條').id, 'l1');
  assert.equal(findNode(data.nodes, 'nothing'), null);
});
test('neighborsOf 回兩端相鄰節點 id', () => {
  const links = toGraphData(data).links;
  assert.deepEqual(neighborsOf(links, 'l1').sort(), ['e1', 'f1']);
});
test('summarize 統計群組、爭點與未該當要件', () => {
  const s = summarize(data);
  assert.equal(s.nodeCounts.law, 1); assert.equal(s.edgeCounts, 3);
  assert.deepEqual(s.topIssues, ['Negligence']); assert.deepEqual(s.unmetElements, ['Causation']);
});
