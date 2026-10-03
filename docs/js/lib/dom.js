// Tiny templating helpers. Every interpolated value is HTML-escaped unless it is
// wrapped with raw() or is the result of another html`` call. This matters: the
// GitHub token lives in this origin, so user text must never become markup.

const SAFE = Symbol('safe');

export function raw(str) {
  return { [SAFE]: true, value: String(str) };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toHtml(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(toHtml).join('');
  if (typeof value === 'object' && value[SAFE]) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += toHtml(v) + strings[i + 1]; });
  return raw(out);
}

export function render(el, template) {
  el.innerHTML = toHtml(template);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegated event listener: on(root, 'click', '[data-action]', (e, el) => ...) */
export function on(root, type, selector, handler, opts) {
  const listener = (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  };
  root.addEventListener(type, listener, opts);
  return () => root.removeEventListener(type, listener, opts);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
