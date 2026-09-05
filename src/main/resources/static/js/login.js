import { t } from './i18n.js';
import { esc } from './views/util.js';

/**
 * 右上角登入區：未登入顯示「Google 登入」與登入好處（每天可多分析幾次）；登入後顯示頭像、名稱與登出。
 * 後端未設定 Google 用戶端（me.enabled=false）時整塊不顯示，頁面其餘功能不受影響。
 */
export function renderLogin(me, quota, locale) {
  if (!me || !me.enabled) return '';
  const memberLimit = quota?.memberLimit ?? 5;
  if (me.loggedIn && me.blocked) {
    // 使用授權排除方：顯示訊息與登出，不提供功能
    return `<div class="auth-user auth-blocked" role="alert">
      <span class="auth-name">${esc(me.blockedMessage || t('license.excluded', locale))}</span>
      <button type="button" id="logout-btn" class="auth-logout">${esc(t('nav.logout', locale))}</button>
    </div>`;
  }
  if (me.loggedIn) {
    const name = me.name || me.email || '';
    const avatar = me.picture
      ? `<img class="avatar" src="${esc(me.picture)}" alt="" referrerpolicy="no-referrer" width="28" height="28">`
      : `<span class="avatar avatar-fallback" aria-hidden="true">${esc((name || '?').slice(0, 1))}</span>`;
    return `<div class="auth-user" title="${esc(me.email || '')}">
      ${avatar}<span class="auth-name">${esc(name)}</span>
      <button type="button" id="logout-btn" class="auth-logout">${esc(t('nav.logout', locale))}</button>
      <button type="button" id="delete-account" class="auth-logout auth-delete">${esc(t('nav.deleteAccount', locale))}</button>
    </div>`;
  }
  const benefit = t('nav.loginBenefit', locale).replace('{limit}', memberLimit);
  return `<a id="login-link" class="login-link" href="${esc(me.loginPath || '/oauth2/authorization/google')}" title="${esc(benefit)}">
    <svg class="g-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.4 10V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10A6 6 0 0 1 12 6z"/></svg>
    <span>${esc(t('nav.login', locale))}</span><small>${esc(benefit)}</small>
  </a>`;
}

/**
 * 綁定登出：以表單 POST /logout，讓瀏覽器自己跟隨 302 回首頁。
 * 不用 fetch(redirect:'manual')＋reload：實測（e2e/diagnose-logout.mjs）那種做法會讓重載後的頁面腳本不執行、停在空白首頁。
 * 另綁「刪除帳號」按鈕（onDelete 由呼叫端處理 confirm／API／reload）。
 */
export function bindLogin(root, { logout, onDelete } = {}) {
  const btn = root.querySelector('#logout-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      if (typeof logout === 'function') { logout(); return; }
      const doc = globalThis.document;
      if (!doc?.createElement) return;
      const form = doc.createElement('form');
      form.method = 'POST'; form.action = '/logout'; form.hidden = true;
      doc.body.appendChild(form); form.submit();
    });
  }
  const delBtn = root.querySelector('#delete-account');
  if (delBtn && typeof onDelete === 'function') {
    delBtn.addEventListener('click', () => onDelete());
  }
}

/**
 * 首次登入個資告知卡：僅在已登入且 me.firstLogin 為真時顯示（PDPA 第 8 條告知義務，僅顯示一次）。
 * 內含「我知道了」按鈕 #privacy-ack，由 bindPrivacy 綁定 onAck。
 */
export function renderPrivacyNotice(me, locale) {
  if (!me?.loggedIn || !me.firstLogin) return '';
  return `<div class="privacy-notice" role="note" aria-live="polite">
    <strong>${esc(t('privacy.notice.title', locale))}</strong>
    <p>${esc(t('privacy.notice.purpose', locale))}</p>
    <p>${esc(t('privacy.notice.fields', locale))}</p>
    <p>${esc(t('privacy.notice.retention', locale))}</p>
    <p>${esc(t('privacy.notice.delete', locale))}</p>
    <button type="button" id="privacy-ack" class="primary">${esc(t('privacy.notice.ack', locale))}</button>
  </div>`;
}

/** 綁定個資告知卡的「我知道了」按鈕。 */
export function bindPrivacy(root, { onAck } = {}) {
  const btn = root.querySelector('#privacy-ack');
  if (!btn || typeof onAck !== 'function') return;
  btn.addEventListener('click', () => onAck());
}
