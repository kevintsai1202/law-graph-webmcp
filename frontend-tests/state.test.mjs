import { test } from 'node:test';
import assert from 'node:assert/strict';
import { States, reduce } from '../src/main/resources/static/js/state.js';

// 用途：頁面狀態機為純函式，這裡守住三個事件的轉移結果。
const s0 = { view: States.INPUT, caseId: null, last: null };
test('START 進 RUNNING 並記 caseId', () => {
  const s = reduce(s0, { type: 'START', caseId: 'p1' });
  assert.equal(s.view, States.RUNNING); assert.equal(s.caseId, 'p1');
});
test('STATUS 依 status 切 view', () => {
  const run = reduce(s0, { type: 'START', caseId: 'p1' });
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'WAITING' } }).view, States.QUESTIONS);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'RUNNING' } }).view, States.RUNNING);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'COMPLETED' } }).view, States.RESULT);
  assert.equal(reduce(run, { type: 'STATUS', status: { status: 'FAILED' } }).view, States.FAILED);
});
test('RESET 回初始', () => {
  assert.deepEqual(reduce({ view: States.RESULT, caseId: 'p1', last: {} }, { type: 'RESET' }), s0);
});
