/** HTML 轉義：所有由後端／模型產生的文字都必須經過這裡。 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 以 DOMParser 解析程式產生的模板字串後掛入容器（不執行 script）。 */
export function mount(el, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  el.replaceChildren(...doc.body.childNodes);
}
