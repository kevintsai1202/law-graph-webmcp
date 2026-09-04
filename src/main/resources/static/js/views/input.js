import { t } from '../i18n.js';
import { esc } from './util.js';
import { ICONS } from './icons.js';
import { OUTPUT_OPTIONS } from '../documents.js';

/** 案情最少字數：與 webmcp.js startCase 的 caseText.minLength 一致，送出鈕在達標前停用。 */
export const MIN_CHARS = 20;
/** 瀏覽器端先限制可選附件數；後端仍會獨立驗證大小、格式與內容。 */
export const MAX_FILES = 5;

/** 輸出項目勾選區：關聯圖預設勾選，其餘書狀由使用者自選。 */
function renderOutputs(locale) {
  const items = OUTPUT_OPTIONS.map((option) => {
    const label = option === 'graph' ? t('output.graph', locale) : t('doc.' + option, locale);
    return `<label class="output-item"><input type="checkbox" name="outputs" value="${option}"${option === 'graph' ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  }).join('');
  return `<fieldset class="outputs" id="output-box">
      <legend>${esc(t('input.outputs', locale))}</legend>
      <div class="output-grid">${items}</div>
      <p class="field-hint">${esc(t('input.outputsHint', locale))}</p>
    </fieldset>`;
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

/** 案情輸入頁：可見標籤＋文字框＋字數提示＋輸出勾選＋送出；右側示範案例卡與免責聲明。 */
export function renderInput({ samples = [], semanticAuth = null, usage = null }, locale) {
  const cards = samples.map((s) =>
    `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span>${ICONS.arrowRight}</button>`).join('');
  const authNotice = renderSemanticAuthNotice(semanticAuth, locale);
  const usageNotice = renderUsageNotice(usage, locale);
  return `<section class="input">
    <div class="input-main card">
      ${usageNotice}
      ${authNotice}
      <label class="field-label" for="case-text">${esc(t('input.label', locale))}</label>
      <textarea id="case-text" rows="10" aria-describedby="case-hint" placeholder="${esc(t('input.placeholder', locale))}"></textarea>
      <div class="field-hint" id="case-hint"><span id="case-hint-text">${esc(t('input.hint', locale))}</span><span class="count" id="case-count" aria-live="polite">0 / ${MIN_CHARS}</span></div>
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
      ${renderOutputs(locale)}
      <div class="input-actions"><button id="case-submit" class="primary" type="button" disabled>${esc(t('input.submit', locale))}</button></div>
    </div>
    <aside class="input-side">
      <h3>${esc(t('input.samples', locale))}</h3><div class="samples">${cards}</div>
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

/** 綁定送出、字數即時回饋與輸出勾選（達標且至少勾一項才啟用送出）、示範案例點選。 */
export function bindInput(root, { onSubmit, onSample }, locale = 'en') {
  const ta = root.querySelector('#case-text'), files = root.querySelector('#case-files');
  const btn = root.querySelector('#case-submit'), count = root.querySelector('#case-count');
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
    btn.disabled = !hasInput || checked().length === 0 || selectedFiles.length > MAX_FILES;
  };
  ta.addEventListener('input', sync);
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
  root.querySelectorAll('input[name="outputs"]').forEach((c) => c.addEventListener('change', sync));
  syncFiles();
  sync();
  btn.addEventListener('click', () => onSubmit(ta.value, checked(), [...selectedFiles]));
  root.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => onSample(b.dataset.sampleId, checked())));
}
