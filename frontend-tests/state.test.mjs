import { test } from 'node:test';
import assert from 'node:assert/strict';
import { States, reduce, initialState } from '../src/main/resources/static/js/state.js';

// 用途：頁面狀態機為純函式；首頁 HOME → 選模式 INPUT → START／STATUS → RESET 回 HOME。
test('初始為 HOME 且無 mode', () => {
  assert.equal(initialState.view, States.HOME);
  assert.equal(initialState.mode, null);
});
test('SELECT_MODE 進 INPUT 並記 mode；未知 mode 退回 case', () => {
  assert.deepEqual(reduce(initialState, { type: 'SELECT_MODE', mode: 'contract' }), { view: States.INPUT, caseId: null, last: null, mode: 'contract' });
  assert.equal(reduce(initialState, { type: 'SELECT_MODE', mode: 'weird' }).mode, 'case');
});
test('START 進 RUNNING 並記 caseId 與 mode', () => {
  const s = reduce(initialState, { type: 'START', caseId: 'p1', mode: 'contract' });
  assert.equal(s.view, States.RUNNING); assert.equal(s.caseId, 'p1'); assert.equal(s.mode, 'contract');
  assert.equal(reduce(initialState, { type: 'START', caseId: 'p1' }).mode, 'case');
});
test('STATUS 依 status 切 view，status.mode 覆寫 mode', () => {
  const run = reduce(initialState, { type: 'START', caseId: 'p1', mode: 'case' });
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'WAITING' } }).view, States.QUESTIONS);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'COMPLETED', mode: 'contract' } }).mode, 'contract');
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'FAILED' } }).view, States.FAILED);
});
test('RESET 與 GO_HOME 回 HOME', () => {
  assert.deepEqual(reduce({ view: States.RESULT, caseId: 'p1', last: {}, mode: 'case' }, { type: 'RESET' }), initialState);
  assert.equal(reduce({ view: States.INPUT, caseId: null, last: null, mode: 'contract' }, { type: 'GO_HOME' }).view, States.HOME);
});

test('SHOW_STATS 進入統計頁但保留 mode 與 caseId，離開後才能回到原案件', () => {
  const running = reduce(initialState, { type: 'START', caseId: 'c1', mode: 'contract' });
  const stats = reduce(running, { type: 'SHOW_STATS' });
  assert.equal(stats.view, 'STATS');
  assert.equal(stats.caseId, 'c1');
  assert.equal(stats.mode, 'contract');
  assert.equal(reduce(initialState, { type: 'SHOW_STATS' }).view, 'STATS');
});
