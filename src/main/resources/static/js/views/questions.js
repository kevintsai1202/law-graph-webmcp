import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';

/** WaitFor 表單：每題編號＋可見題目（label）＋「為何要問」＋ textarea；答案草稿會保留在欄位。 */
export function renderQuestions({ questions = [], answers = {}, notice = '' }, locale) {
  const items = questions.map((q, i) => `<label class="q"><span class="q-no" aria-hidden="true">${i + 1}</span><span class="q-text">${esc(q.text)}</span>
    <small>${esc(t('questions.why', locale))}: ${esc(q.why)}</small><textarea name="${esc(q.id)}" rows="2">${esc(answers[q.id] || '')}</textarea></label>`).join('');
  const noticeHtml = notice ? `<p id="question-fill-notice" class="question-fill-notice" role="status">${esc(notice)}</p>` : '';
  return `<form id="questions-form" class="questions card"><h2>${esc(t('questions.title', locale))}</h2><p class="lead">${esc(t('questions.lead', locale))}</p>${noticeHtml}${items}
    <div class="questions-actions"><button type="submit" class="primary">${ICONS.send}${esc(t('questions.submit', locale))}</button></div></form>`;
}

/** 送出時收集 [{questionId, answer}]。 */
export function bindQuestions(root, { onSubmit }) {
  root.querySelector('#questions-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = [...e.currentTarget.querySelectorAll('textarea')].map((ta) => ({ questionId: ta.name, answer: ta.value }));
    onSubmit(answers);
  });
}
