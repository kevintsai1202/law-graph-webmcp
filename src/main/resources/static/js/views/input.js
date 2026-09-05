import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';
import { outputOptionsFor } from '../documents.js';
import { CONTRACT_PARTIES, CONTRACT_SCOPES } from '../contract.js';

/** 案情最少字數：與 webmcp.js startCase 的 caseText.minLength 一致，送出鈕在達標前停用。 */
export const MIN_CHARS = 20;
/** 瀏覽器端先限制可選附件數；後端仍會獨立驗證大小、格式與內容。 */
export const MAX_FILES = 5;

/** 輸出項目勾選區：case 模式關聯圖預設勾選、其餘書狀自選；contract 模式只有「修訂本」且不預勾。 */
function renderOutputs(locale, mode = 'case') {
  const contract = mode === 'contract';
  const options = outputOptionsFor(mode);
  const items = options.map((option) => {
    const label = contract ? t('doc.revised', locale) : (option === 'graph' ? t('output.graph', locale) : t('doc.' + option, locale));
    return `<label class="output-item"><input type="checkbox" name="outputs" value="${option}"${!contract && option === 'graph' ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  }).join('');
  return `<fieldset class="outputs" id="output-box">
      <legend>${esc(t(contract ? 'contract.outputs' : 'input.outputs', locale))}</legend>
      <div class="output-grid">${items}</div>
      <p class="field-hint">${esc(t(contract ? 'contract.outputsHint' : 'input.outputsHint', locale))}</p>
    </fieldset>`;
}

/** 合約模式專屬欄位：我方立場（radio）與審查範疇（checkbox）。 */
function renderContractFields(locale) {
  const parties = CONTRACT_PARTIES.map((p) =>
    `<label class="output-item"><input type="radio" name="party" value="${p}"${p === 'unknown' ? ' checked' : ''}><span>${esc(t('contract.party.' + p, locale))}</span></label>`
  ).join('');
  const scopes = CONTRACT_SCOPES.map((s) =>
    `<label class="output-item"><input type="checkbox" name="scopes" value="${s}"><span>${esc(t('contract.scope.' + s, locale))}</span></label>`
  ).join('');
  return `<fieldset class="outputs" id="contract-party"><legend>${esc(t('contract.party', locale))}</legend><div class="output-grid">${parties}</div></fieldset>
    <fieldset class="outputs" id="contract-scopes"><legend>${esc(t('contract.scopes', locale))}</legend><div class="output-grid">${scopes}</div><p class="field-hint">${esc(t('contract.scopesHint', locale))}</p></fieldset>`;
}

/** 語意檢索授權提示：當語意功能開啟但尚未授權時，在表單頂部顯示授權提醒與一鍵授權按鈕。 */
function renderSemanticAuthNotice(auth, locale) {
  if (!auth || !auth.enabled || auth.authorized) return '';
  return `<div class="semantic-auth-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t('auth.semantic.required', locale))}</strong>
      <span>${esc(t('auth.semantic.tip', locale))}</span>
    </div>
    <a href="${esc(auth.startPath || '/api/auth/tw-legal-rag/start')}" class="auth-link">${esc(t('auth.semantic.action', locale))} ↗</a>
  </div>`;
}

/** Law Powers 技能頁：額度用完時引導使用者改用自己的 AI Agent。 */
export const LAW_POWERS_URL = 'https://kevintsai1202.github.io/law-powers/';

/** 今日 token 額度用完（或手動暫停）時顯示的提示；含 Law Powers 連結。 */
function renderUsageNotice(usage, locale) {
  if (!usage || !usage.exhausted) return '';
  return `<div class="semantic-auth-banner usage-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t('usage.exhausted.title', locale))}</strong>
      <span>${esc(t('usage.exhausted.tip', locale))}</span>
    </div>
    <a href="${LAW_POWERS_URL}" class="auth-link" target="_blank" rel="noopener">${esc(t('usage.exhausted.action', locale))} ↗</a>
  </div>`;
}

/** 每日案件配額：常駐顯示「今日已用 n / N 次」與限制原因；用完時改成醒目橫幅。沒有配額資料（後端不限制）就不顯示。 */
export function renderQuota(quota, locale) {
  if (!quota || !(quota.limit > 0)) return '';
  const count = `${quota.used} / ${quota.limit}`;
  // 匿名者且登入可拿到更高上限時，附上登入提示（連到後端提供的登入路徑）
  const loginTip = !quota.loggedIn && quota.memberLimit > quota.limit
    ? ` <a class="quota-login" href="${esc(quota.loginPath || '/oauth2/authorization/google')}">${esc(t('quota.loginTip', locale).replace('{limit}', quota.memberLimit))}</a>`
    : '';
  if (quota.exhausted) {
    return `<div class="semantic-auth-banner quota-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t('quota.exhausted.title', locale).replace('{limit}', quota.limit))}</strong>
      <span>${esc(t('quota.reason', locale).replace('{limit}', quota.limit))}${loginTip}</span>
    </div>
    <a href="${LAW_POWERS_URL}" class="auth-link" target="_blank" rel="noopener">${esc(t('usage.exhausted.action', locale))} ↗</a>
  </div>`;
  }
  return `<p class="field-hint quota-note" aria-live="polite"><strong>${esc(t('quota.count', locale))} ${esc(count)}</strong> <span>${esc(t('quota.reason', locale).replace('{limit}', quota.limit))}${loginTip}</span></p>`;
}

/** 案情輸入頁：可見標籤＋文字框＋字數提示＋輸出勾選＋送出；右側示範案例卡與免責聲明。 */
export function renderInput({ samples = [], semanticAuth = null, usage = null, quota = null, mode = 'case' }, locale) {
  // 合約模式旗標：切換標籤／預留位置／提示／送出鈕文字，並插入立場與範疇欄位、拿掉聲請欄
  const contract = mode === 'contract';
  const cards = samples.map((s) =>
    `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span>${ICONS.arrowRight}</button>`).join('');
  const authNotice = renderSemanticAuthNotice(semanticAuth, locale);
  const usageNotice = renderUsageNotice(usage, locale);
  const quotaNotice = renderQuota(quota, locale);
  return `<section class="input">
    <div class="input-main card">
      ${usageNotice}
      ${quotaNotice}
      ${authNotice}
      <label class="field-label" for="case-text">${esc(t(contract ? 'contract.label' : 'input.label', locale))}</label>
      <textarea id="case-text" rows="3" aria-describedby="case-hint" placeholder="${esc(t(contract ? 'contract.placeholder' : 'input.placeholder', locale))}"></textarea>
      <!-- 失焦且已有內容時，以三行預覽取代輸入框（超長以 … 收尾）；點預覽即回到輸入框並放大 -->
      <button type="button" class="case-preview" id="case-preview" hidden aria-label="${esc(t('input.previewAria', locale))}"></button>
      <div class="field-hint" id="case-hint"><span id="case-hint-text">${esc(t(contract ? 'contract.hint' : 'input.hint', locale))}</span><span class="count" id="case-count" aria-live="polite">0 / ${MIN_CHARS}</span></div>
      <div class="upload-field">
        <label class="field-label" for="case-files">${esc(t('input.files', locale))}</label>
        <input class="upload-input" id="case-files" type="file" accept=".pdf,.md,.markdown,.docx" multiple aria-describedby="file-hint file-status">
        <button class="upload-dropzone" id="file-dropzone" type="button" aria-describedby="file-hint file-status">
          <span class="upload-icon" aria-hidden="true">${ICONS.upload}</span>
          <span class="upload-copy"><strong>${esc(t('input.filesDropTitle', locale))}</strong><span>${esc(t('input.filesDropAction', locale))}</span></span>
          <span class="upload-formats">${esc(t('input.filesFormats', locale))}</span>
        </button>
        <div class="file-list" id="file-list" role="list" aria-label="${esc(t('input.filesList', locale))}"></div>
        <div class="field-hint" id="file-hint">${esc(t('input.filesHint', locale))}</div>
        <p class="file-status" id="file-status" aria-live="polite">${esc(t('input.filesEmpty', locale))}</p>
      </div>
      ${contract ? renderContractFields(locale) : ''}
      ${renderOutputs(locale, mode)}
      ${contract ? '' : `<div class="motion-field" id="motion-field" hidden>
        <label class="field-label" for="motion-request">${esc(t('input.motionRequest', locale))}</label>
        <input id="motion-request" type="text" maxlength="200" placeholder="${esc(t('input.motionRequestPlaceholder', locale))}">
      </div>`}
      <div class="input-actions"><button id="case-submit" class="primary" type="button" disabled>${esc(t(contract ? 'input.submitContract' : 'input.submit', locale))}</button></div>
    </div>
    <aside class="input-side">
      <h3>${esc(t(contract ? 'input.samplesContract' : 'input.samples', locale))}</h3><div class="samples">${cards}</div>
      <p class="disclaimer">${ICONS.info}<span>${esc(t('disclaimer', locale))}</span></p>
      <p class="disclaimer lawpowers-note">${ICONS.info}<span>${esc(t('input.lawPowers', locale))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t('input.lawPowersAction', locale))} ↗</a></span></p>
    </aside></section>`;
}

/** 將位元組數轉成易讀大小，避免檔案卡片出現過長數字。 */
function formatFileSize(bytes, locale) {
  if (bytes < 1024) return `${bytes} B`;
  const value = bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024);
  const unit = bytes < 1024 * 1024 ? 'KB' : 'MB';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

/** 以名稱、大小與修改時間去除重複拖入的同一檔案。 */
function mergeFiles(current, incoming) {
  const fileMap = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
  incoming.forEach((file) => fileMap.set(`${file.name}:${file.size}:${file.lastModified}`, file));
  return [...fileMap.values()];
}

/** 以安全 DOM API 渲染檔案卡片；檔名只寫入 textContent，不插入 HTML。 */
function renderFileList(container, files, locale) {
  container.replaceChildren();
  if (!files.length) return;
  const doc = container.ownerDocument || globalThis.document;
  files.forEach((file, index) => {
    const item = doc.createElement('div');
    item.className = 'file-item';
    item.setAttribute('role', 'listitem');

    const extension = doc.createElement('span');
    extension.className = 'file-extension';
    extension.textContent = (file.name.split('.').pop() || 'FILE').slice(0, 5).toUpperCase();

    const detail = doc.createElement('span');
    detail.className = 'file-detail';
    const name = doc.createElement('strong');
    name.className = 'file-name';
    name.textContent = file.name;
    const size = doc.createElement('span');
    size.className = 'file-size';
    size.textContent = formatFileSize(file.size, locale);
    detail.append(name, size);

    const remove = doc.createElement('button');
    remove.className = 'file-remove';
    remove.type = 'button';
    remove.dataset.fileIndex = String(index);
    remove.setAttribute('aria-label', t('input.filesRemove', locale).replace('{name}', file.name));
    remove.innerHTML = ICONS.close;
    item.append(extension, detail, remove);
    container.append(item);
  });
}

/**
 * 綁定送出、字數即時回饋與輸出勾選（達標且至少勾一項才啟用送出）、示範案例點選。
 * locked：今日配額或站台 AI 額度已用完時為 true，送出鈕永遠停用並附說明，避免送出後才收到錯誤。
 */
export function bindInput(root, { onSubmit, onSample }, locale = 'en', mode = 'case', { locked = false } = {}) {
  const ta = root.querySelector('#case-text'), files = root.querySelector('#case-files');
  const btn = root.querySelector('#case-submit'), count = root.querySelector('#case-count');
  if (locked) btn.title = t('input.submitLocked', locale);
  const dropzone = root.querySelector('#file-dropzone'), fileList = root.querySelector('#file-list');
  const fileStatus = root.querySelector('#file-status');
  /** 字數提示文字節點；附檔時改顯示「描述可留空」說明。 */
  const hintText = root.querySelector('#case-hint-text');
  /** 目前選取的檔案；拖放與原生選檔共用同一份記憶體狀態。 */
  let selectedFiles = [...files.files];
  /** 拖曳進入深度，避免游標跨過子元素時誤取消高亮。 */
  let dragDepth = 0;
  /** 目前勾選的輸出值清單。 */
  const checked = () => [...root.querySelectorAll('input[name="outputs"]:checked')].map((c) => c.value);
  /** 聲請事項欄位：只在勾選「聲請狀」時顯示。 */
  const motionField = root.querySelector('#motion-field'), motionInput = root.querySelector('#motion-request');
  const syncMotion = () => { if (motionField) motionField.hidden = !checked().includes('motion'); };
  /** 更新檔案清單、數量與錯誤狀態。 */
  const syncFiles = () => {
    renderFileList(fileList, selectedFiles, locale);
    fileStatus.textContent = selectedFiles.length
      ? t(selectedFiles.length > MAX_FILES ? 'input.filesTooMany' : 'input.filesSelected', locale).replace('{count}', selectedFiles.length)
      : t('input.filesEmpty', locale);
    fileStatus.classList.toggle('error', selectedFiles.length > MAX_FILES);
  };
  /** 依目前字數、附檔與勾選狀態更新計數、提示與按鈕：已附參考文件時描述不強制達 20 字。 */
  const sync = () => {
    const n = ta.value.trim().length;
    const hasFiles = selectedFiles.length > 0;
    count.textContent = hasFiles ? `${n}` : `${n} / ${MIN_CHARS}`;
    count.classList.toggle('ok', hasFiles || n >= MIN_CHARS);
    if (hintText) hintText.textContent = t(hasFiles ? 'input.hintWithFiles' : 'input.hint', locale);
    const hasInput = n >= MIN_CHARS || hasFiles;
    // 合約模式不要求勾選輸出（送出即代表要修訂本）
    btn.disabled = locked || !hasInput || (mode !== 'contract' && checked().length === 0) || selectedFiles.length > MAX_FILES;
  };
  ta.addEventListener('input', sync);
  /** 失焦縮小：有內容就換成三行預覽（CSS line-clamp 以 … 收尾）；取得焦點放大並隱藏預覽。 */
  const preview = root.querySelector('#case-preview');
  const collapse = () => {
    ta.classList.remove('expanded');
    if (!preview) return;
    const text = ta.value.trim();
    if (text) { preview.textContent = ta.value; preview.hidden = false; ta.hidden = true; }
  };
  const expand = () => {
    if (preview) { preview.hidden = true; ta.hidden = false; }
    ta.classList.add('expanded');
  };
  ta.addEventListener('focus', expand);
  ta.addEventListener('blur', collapse);
  if (preview) preview.addEventListener('click', () => { expand(); ta.focus?.(); });
  files.addEventListener('change', () => {
    selectedFiles = [...files.files];
    syncFiles();
    sync();
  });
  dropzone.addEventListener('click', () => files.click());
  dropzone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth++;
    dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  dropzone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropzone.classList.remove('is-dragging');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('is-dragging');
    selectedFiles = mergeFiles(selectedFiles, [...(event.dataTransfer?.files || [])]);
    syncFiles();
    sync();
  });
  fileList.addEventListener('click', (event) => {
    const remove = event.target.closest?.('[data-file-index]');
    if (!remove) return;
    selectedFiles.splice(Number(remove.dataset.fileIndex), 1);
    files.value = '';
    syncFiles();
    sync();
  });
  root.querySelectorAll('input[name="outputs"]').forEach((c) => c.addEventListener('change', () => { syncMotion(); sync(); }));
  syncFiles();
  syncMotion();
  sync();
  // 合約模式的附加欄位：我方立場與審查範疇；case 模式回空物件維持既有呼叫契約
  const extra = () => mode === 'contract' ? {
    party: root.querySelector('input[name="party"]:checked')?.value || 'unknown',
    scopes: [...root.querySelectorAll('input[name="scopes"]:checked')].map((c) => c.value)
  } : {};
  btn.addEventListener('click', () => onSubmit(ta.value, checked(), [...selectedFiles],
    mode !== 'contract' && checked().includes('motion') && motionInput ? (motionInput.value || '').trim() : '', extra()));
  root.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => onSample(b.dataset.sampleId, checked(), extra())));
}
