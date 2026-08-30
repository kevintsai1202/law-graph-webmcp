import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';

/** 案情最少字數：與 webmcp.js startCase 的 caseText.minLength 一致，送出鈕在達標前停用。 */
export const MIN_CHARS = 20;

/** 案情輸入頁：可見標籤＋文字框＋字數提示＋送出；右側示範案例卡與免責聲明。 */
export function renderInput({ samples = [] }, locale) {
  const cards = samples.map((s) =>
    `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span>${ICONS.arrowRight}</button>`).join('');
  return `<section class="input">
    <div class="input-main card">
      <label class="field-label" for="case-text">${esc(t('input.label', locale))}</label>
      <textarea id="case-text" rows="10" aria-describedby="case-hint" placeholder="${esc(t('input.placeholder', locale))}"></textarea>
      <div class="field-hint" id="case-hint"><span>${esc(t('input.hint', locale))}</span><span class="count" id="case-count" aria-live="polite">0 / ${MIN_CHARS}</span></div>
      <div class="input-actions"><button id="case-submit" class="primary" type="button" disabled>${esc(t('input.submit', locale))}</button></div>
    </div>
    <aside class="input-side">
      <h3>${esc(t('input.samples', locale))}</h3><div class="samples">${cards}</div>
      <p class="disclaimer">${ICONS.info}<span>${esc(t('disclaimer', locale))}</span></p>
    </aside></section>`;
}

/** 綁定送出、字數即時回饋（達標才啟用送出）與示範案例點選。 */
export function bindInput(root, { onSubmit, onSample }) {
  const ta = root.querySelector('#case-text'), btn = root.querySelector('#case-submit'), count = root.querySelector('#case-count');
  /** 依目前字數更新計數與按鈕狀態。 */
  const sync = () => {
    const n = ta.value.trim().length;
    count.textContent = `${n} / ${MIN_CHARS}`;
    count.classList.toggle('ok', n >= MIN_CHARS);
    btn.disabled = n < MIN_CHARS;
  };
  ta.addEventListener('input', sync);
  sync();
  btn.addEventListener('click', () => onSubmit(ta.value));
  root.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => onSample(b.dataset.sampleId)));
}
