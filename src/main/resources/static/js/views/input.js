import { t } from '../i18n.js';
import { esc } from './util.js';

/** 案情輸入頁：文字框＋示範案例卡＋免責聲明。 */
export function renderInput({ samples = [] }, locale) {
  const cards = samples.map((s) =>
    `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span></button>`).join('');
  return `<section class="input">
    <textarea id="case-text" rows="10" placeholder="${esc(t('input.placeholder', locale))}"></textarea>
    <button id="case-submit" class="primary" type="button">${esc(t('input.submit', locale))}</button>
    <h3>${esc(t('input.samples', locale))}</h3><div class="samples">${cards}</div>
    <p class="disclaimer">${esc(t('disclaimer', locale))}</p></section>`;
}

/** 綁定送出與示範案例點選。 */
export function bindInput(root, { onSubmit, onSample }) {
  root.querySelector('#case-submit').addEventListener('click', () => onSubmit(root.querySelector('#case-text').value));
  root.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => onSample(b.dataset.sampleId)));
}
