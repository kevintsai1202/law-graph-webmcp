import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';

/** 「網站已更新」橫幅：說明文字＋重新載入鈕；role=status 讓讀屏軟體被動宣讀而不打斷操作。 */
export function renderUpdateBanner(locale) {
  return `<div class="update-banner" role="status">
    <span class="update-icon" aria-hidden="true">${ICONS.refresh}</span>
    <div class="update-message"><strong>${esc(t('update.title', locale))}</strong><span>${esc(t('update.desc', locale))}</span></div>
    <button type="button" class="primary" id="update-reload">${esc(t('update.action', locale))}</button>
  </div>`;
}

/** 綁定重新載入鈕；onReload 由呼叫端決定（正式為 location.reload()）。 */
export function bindUpdateBanner(root, { onReload }) {
  root.querySelector('#update-reload')?.addEventListener('click', () => onReload());
}
