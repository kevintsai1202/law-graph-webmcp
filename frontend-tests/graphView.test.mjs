import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGraphData, findNode, neighborsOf, summarize } from '../src/main/resources/static/js/graphView.js';

// 用途：graphView 中不碰 DOM／WebGL 的純函式，在 node 驗證資料轉換與摘要。
const data = { nodes: [
  { id: 'f1', group: 'fact', label: 'Crash' }, { id: 'l1', group: 'law', label: 'Civil Code Art. 184 ¶1（民法第184條第1項）' },
  { id: 'i1', group: 'issue', label: 'Negligence' }, { id: 'e1', group: 'element', label: 'Causation', met: 'unknown' }],
  edges: [{ from: 'f1', to: 'l1', label: '適用' }, { from: 'ghost', to: 'l1', label: '引用' }, { from: 'l1', to: 'e1', label: '要件', title: 'decomposed' }] };

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
