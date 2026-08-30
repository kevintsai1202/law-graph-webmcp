import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, detectLocale, DICT } from '../src/main/resources/static/js/i18n.js';

// 用途：守住雙語字典鍵集合一致、缺 key 回 key、語系偵測優先序。
test('兩語字典鍵集合一致', () => {
  assert.deepEqual(Object.keys(DICT.en).sort(), Object.keys(DICT['zh-TW']).sort());
});
test('t 缺 key 回 key、依語系取字', () => {
  assert.equal(t('app.title', 'en'), 'Law Graph');
  assert.equal(t('app.title', 'zh-TW'), '法律關係圖');
  assert.equal(t('nope.key', 'en'), 'nope.key');
});
test('detectLocale：儲存值優先，其次 zh 前綴，否則 en', () => {
  assert.equal(detectLocale('zh-TW', 'en'), 'en');
  assert.equal(detectLocale('zh-Hant-TW', null), 'zh-TW');
  assert.equal(detectLocale('ja', null), 'en');
});
