import { t } from '../i18n.js';
import { esc } from './util.js';

/** WaitFor 表單：每題 textarea＋「為何要問」。 */
export function renderQuestions({ questions = [] }, locale) {
  const items = questions.map((q) => `<label class="q"><span class="q-text">${esc(q.text)}</span>
    <small>${esc(t('questions.why', locale))}: ${esc(q.why)}</small><textarea name="${esc(q.id)}" rows="2"></textarea></label>`).join('');
  return `<form id="questions-form" class="questions"><h2>${esc(t('questions.title', locale))}</h2>${items}
    <button type="submit" class="primary">${esc(t('questions.submit', locale))}</button></form>`;
}

/** 送出時收集 [{questionId, answer}]。 */
export function bindQuestions(root, { onSubmit }) {
  root.querySelector('#questions-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = [...e.currentTarget.querySelectorAll('textarea')].map((ta) => ({ questionId: ta.name, answer: ta.value }));
    onSubmit(answers);
  });
}
