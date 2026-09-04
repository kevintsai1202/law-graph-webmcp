import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLogin } from '../src/main/resources/static/js/login.js';

// 用途：右上角登入區三種狀態（未啟用／未登入／已登入）的呈現契約。
test('後端未啟用 Google 登入時整塊不顯示', () => {
  assert.equal(renderLogin({ enabled: false, loggedIn: false }, null, 'zh-TW'), '');
  assert.equal(renderLogin(null, null, 'zh-TW'), '');
});

test('未登入：顯示 Google 登入連結與登入好處（每天可分析 5 次）', () => {
  const html = renderLogin({ enabled: true, loggedIn: false, loginPath: '/oauth2/authorization/google' }, { memberLimit: 5 }, 'zh-TW');
  assert.match(html, /href="\/oauth2\/authorization\/google"/);
  assert.match(html, /Google 登入/);
  assert.match(html, /每天可分析 5 次/);
  assert.match(renderLogin({ enabled: true, loggedIn: false }, { memberLimit: 5 }, 'en'), /5 analyses per day/);
});

test('已登入：顯示頭像、名稱與登出；名稱／圖片經 esc', () => {
  const html = renderLogin({ enabled: true, loggedIn: true, name: 'Kevin <b>', email: 'k@example.com', picture: 'https://img/x.png' }, { memberLimit: 5 }, 'zh-TW');
  assert.match(html, /<img class="avatar" src="https:\/\/img\/x\.png"/);
  assert.match(html, /Kevin &lt;b&gt;/);
  assert.match(html, /id="logout-btn"/);
  assert.match(html, /登出/);
  // 沒有頭像時用名稱首字母
  const noPic = renderLogin({ enabled: true, loggedIn: true, name: 'Amy' }, null, 'en');
  assert.match(noPic, /avatar-fallback[^>]*>A</);
});

test('登入者為使用授權排除方：顯示拒絕訊息與登出，不顯示頭像', () => {
  const html = renderLogin({ enabled: true, loggedIn: true, name: 'X', picture: 'https://img/x.png', blocked: true, blockedMessage: '依本專案使用授權，本服務不提供經兆國際法律事務所使用。' }, null, 'zh-TW');
  assert.match(html, /auth-blocked/);
  assert.match(html, /經兆國際法律事務所/);
  assert.match(html, /id="logout-btn"/);
  assert.doesNotMatch(html, /<img class="avatar"/);
});
