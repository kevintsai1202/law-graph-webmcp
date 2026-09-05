import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';
import { renderQuota } from './input.js';

/** 兩種能力的圖示（SVG，不用 emoji）：案件分析＝天平，合約審查＝文件勾選。 */
const CAP_ICONS = {
  case: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 21h14M12 6l-6 3 6-3 6 3-6-3"/><path d="M3 14a3 3 0 0 0 6 0L6 9l-3 5zM15 14a3 3 0 0 0 6 0l-3-5-3 5z"/></svg>',
  contract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 15.5l2 2 3.5-4"/></svg>'
};

/** 首頁能力入口：兩張等寬卡片（標題、描述、七步小字、開始鈕），點卡片或按鈕都可進入；卡片下方顯示今日配額列。 */
export function renderHome(locale, { quota = null } = {}) {
  const card = (mode) => `<article class="capability card" data-mode="${mode}" tabindex="0" role="button" aria-label="${esc(t(`home.${mode}.title`, locale))}">
      <span class="cap-icon" aria-hidden="true">${CAP_ICONS[mode]}</span>
      <h2>${esc(t(`home.${mode}.title`, locale))}</h2>
      <p>${esc(t(`home.${mode}.desc`, locale))}</p>
      <p class="cap-steps">${esc(t(`home.steps.${mode}`, locale))}</p>
      <button type="button" class="primary" data-mode="${mode}" tabindex="-1">${esc(t('home.start', locale))}${ICONS.arrowRight}</button>
    </article>`;
  return `<section class="home"><h2 class="home-title">${esc(t('home.title', locale))}</h2><p class="home-lead">${esc(t('home.lead', locale))}</p>
    <div class="capabilities">${card('case')}${card('contract')}</div>
    ${renderQuota(quota, locale)}
    <p class="disclaimer">${ICONS.info}<span>${esc(t('disclaimer', locale))}</span></p></section>`;
}

/**
 * 綁定卡片與按鈕點選、Enter 鍵。
 * 按鈕聚焦時按 Enter 會先觸發原生 click（冒泡到卡片的 click 監聽），
 * 若 keydown 監聽不排除來自 button 的事件，會導致 onSelect 觸發兩次，故此處判斷 target 是否落在 button 內。
 */
export function bindHome(root, { onSelect }) {
  root.querySelectorAll('.capability').forEach((card) => {
    const go = () => onSelect(card.dataset.mode);
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.target?.closest?.('button')) go(); });
  });
}
