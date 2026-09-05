import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLogin, bindLogin, renderPrivacyNotice, bindPrivacy } from '../src/main/resources/static/js/login.js';

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
  assert.match(html, /id="delete-account"/);
  assert.match(html, /刪除帳號/);
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

test('登出按鈕以表單 POST /logout 送出，不用 fetch＋reload', () => {
  const submitted = [];
  const form = { method: '', action: '', hidden: false, submit() { submitted.push(this.action + ':' + this.method); } };
  const appended = [];
  globalThis.document = { createElement: () => form, body: { appendChild: (n) => appended.push(n) } };
  const btn = { disabled: false, listeners: new Map(), addEventListener(t, l) { this.listeners.set(t, l); } };
  bindLogin({ querySelector: () => btn });
  btn.listeners.get('click')();
  delete globalThis.document;
  assert.equal(btn.disabled, true);
  assert.deepEqual(submitted, ['/logout:POST']);
  assert.equal(appended.length, 1);
});

test('刪除帳號按鈕點擊呼叫 onDelete', () => {
  const delBtn = { listeners: new Map(), addEventListener(t, l) { this.listeners.set(t, l); } };
  const fakeRoot = { querySelector: (sel) => (sel === '#delete-account' ? delBtn : null) };
  let called = 0;
  bindLogin(fakeRoot, { onDelete: () => { called += 1; } });
  delBtn.listeners.get('click')();
  assert.equal(called, 1);
});

// 用途：首次登入個資告知卡——只在已登入且 firstLogin 為真時出現；ack 後由呼叫端負責移除（本函式只負責渲染）。
test('首次登入才顯示個資告知卡；未登入或已告知過則不顯示', () => {
  assert.equal(renderPrivacyNotice(null, 'zh-TW'), '');
  assert.equal(renderPrivacyNotice({ loggedIn: false, firstLogin: true }, 'zh-TW'), '');
  assert.equal(renderPrivacyNotice({ loggedIn: true, firstLogin: false }, 'zh-TW'), '');
  const html = renderPrivacyNotice({ loggedIn: true, firstLogin: true }, 'zh-TW');
  assert.match(html, /class="privacy-notice"/);
  assert.match(html, /role="note"/);
  assert.match(html, /id="privacy-ack"/);
  assert.match(html, /個資告知/);
  assert.match(renderPrivacyNotice({ loggedIn: true, firstLogin: true }, 'en'), /Personal data notice/);
});

test('bindPrivacy 綁定 #privacy-ack 按鈕觸發 onAck', () => {
  const btn = { listeners: new Map(), addEventListener(t, l) { this.listeners.set(t, l); } };
  const root = { querySelector: () => btn };
  let called = 0;
  bindPrivacy(root, { onAck: () => { called += 1; } });
  btn.listeners.get('click')();
  assert.equal(called, 1);
});
