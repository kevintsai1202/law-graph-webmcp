import { t } from '../i18n.js';
import { esc } from './util.js';

/** 六個流程步驟（與後端 CaseStatus.step 同名）；未勾書狀時 DOCUMENTS 幾乎瞬間通過。 */
export const STEPS = ['BRAINSTORM', 'QUESTIONS', 'RESEARCH', 'ANALYSIS', 'DOCUMENTS', 'GRAPH'];

/** 進行中／等待回答時的退路：放棄此案回到輸入頁（由 app.js 綁到 reset）。 */
export function renderCancel(locale) {
  return `<div class="cancel-row"><button id="cancel-case" type="button" class="ghost">${esc(t('progress.cancel', locale))}</button></div>`;
}

/**
 * 五步進度列：當前 active（aria-current="step"）、之前 done；每步帶序號圓點。
 * busy=true 時 active 步驟顯示旋轉環（系統仍在工作）；等待人工回答時不轉。
 */
export function renderProgress({ step, busy = true }, locale) {
  const idx = STEPS.indexOf(step);
  return `<ol class="progress" aria-label="${esc(t('progress.aria', locale))}">${STEPS.map((s, i) => {
    const cls = i < idx ? 'step done' : i === idx ? 'step active' : 'step';
    // busy 以 data 屬性表示（CSS .step.active[data-busy]），class 維持「step active」讓既有測試與樣式穩定
    const current = i === idx ? ` aria-current="step"${busy ? ' data-busy' : ''}` : '';
    return `<li class="${cls}" data-step="${s}"${current}><span class="step-no" aria-hidden="true">${i + 1}</span><span class="step-label">${esc(t('progress.' + s, locale))}</span></li>`;
  }).join('')}</ol>`;
}
