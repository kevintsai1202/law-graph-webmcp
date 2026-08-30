import { t } from '../i18n.js';
import { esc } from './util.js';

/** 五個流程步驟（與後端 CaseStatus.step 同名）。 */
export const STEPS = ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'GRAPH'];

/** 五步進度列：當前 active、之前 done。 */
export function renderProgress({ step }, locale) {
  const idx = STEPS.indexOf(step);
  return `<ol class="progress">${STEPS.map((s, i) =>
    `<li class="step ${i < idx ? 'done' : i === idx ? 'active' : ''}" data-step="${s}">${esc(t('progress.' + s, locale))}</li>`).join('')}</ol>`;
}
