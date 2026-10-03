import { html, raw, render, $, on } from '../lib/dom.js';
import {
  TYPES, SOURCES, MACROS, MACRO_ORDER, CATEGORIES, INCOME_CATEGORIES,
  categoriesOf, categoryLabel, categoryColor, macroColor,
} from '../models/catalog.js';
import { money } from '../lib/format.js';

// ---- icons (inline SVG, stroke = currentColor) -------------------------------

const svg = (d, size = 18) => raw(
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`,
);

export const icons = {
  plus: () => svg('<path d="M12 5v14M5 12h14"/>'),
  edit: () => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>', 16),
  copy: () => svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 16),
  trash: () => svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', 16),
  left: () => svg('<path d="m15 18-6-6 6-6"/>'),
  right: () => svg('<path d="m9 18 6-6-6-6"/>'),
  close: () => svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: () => svg('<path d="M20 6 9 17l-5-5"/>', 16),
  dashboard: () => svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>', 20),
  list: () => svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 20),
  history: () => svg('<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>', 20),
  settings: () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>', 20),
  up: () => svg('<path d="m6 15 6-6 6 6"/>', 14),
  down: () => svg('<path d="m6 9 6 6 6-6"/>', 14),
};

// ---- small building blocks -----------------------------------------------

export const dot = (color) => html`<span class="dot" style="--c:${color}"></span>`;

export const categoryTag = (category) =>
  (category
    ? html`<span class="cat-tag">${dot(CATEGORIES[category] ? categoryColor(category) : 'var(--ink-3)')}${categoryLabel(category)}</span>`
    : html`<span class="cat-tag muted">Transfer</span>`);

export const sourcePill = (t) =>
  (t.type === 'transfer'
    ? html`<span class="pill">${SOURCES[t.source]?.short} → ${SOURCES[t.toSource]?.short}</span>`
    : html`<span class="pill ${t.source === 'parents_cc' ? 'pill-card' : ''}">${SOURCES[t.source]?.short ?? t.source}</span>`);

export function signedAmount(t) {
  if (t.type === 'transfer') return html`<span class="amt amt-neutral">${money(t.amount)}</span>`;
  if (t.type === 'expense') return html`<span class="amt">−${money(t.amount)}</span>`;
  return html`<span class="amt amt-pos">+${money(t.amount)}</span>`;
}

/** Delta vs average where *less* spending is good. */
export function deltaBadge(current, avg) {
  if (!avg || avg < 1) return '';
  const d = (current - avg) / avg;
  if (Math.abs(d) < 0.03) return html`<span class="delta">≈ avg</span>`;
  const worse = d > 0;
  return html`<span class="delta ${worse ? 'delta-bad' : 'delta-good'}">${worse ? icons.up() : icons.down()}${Math.round(Math.abs(d) * 100)}%</span>`;
}

export function categoryOptions(type, selected) {
  if (type === 'income') {
    return Object.entries(INCOME_CATEGORIES)
      .map(([id, c]) => html`<option value="${id}" ${id === selected ? raw('selected') : ''}>${c.label}</option>`);
  }
  return MACRO_ORDER.map((m) => html`
    <optgroup label="${MACROS[m].label}">
      ${categoriesOf(m).map((id) => html`<option value="${id}" ${id === selected ? raw('selected') : ''}>${CATEGORIES[id].label}</option>`)}
    </optgroup>`);
}

export const sourceOptions = (selected, exclude) =>
  Object.entries(SOURCES).filter(([id]) => id !== exclude)
    .map(([id, s]) => html`<option value="${id}" ${id === selected ? raw('selected') : ''}>${s.label}</option>`);

export const typeOptions = (selected) =>
  Object.entries(TYPES).map(([id, t]) => html`<option value="${id}" ${id === selected ? raw('selected') : ''}>${t.label}</option>`);

export const macroSwatch = (m) => html`${dot(macroColor(m))}${MACROS[m].label}`;

export const emptyState = (title, body) => html`<div class="empty"><strong>${title}</strong><p>${body}</p></div>`;

// ---- toast -----------------------------------------------------------------

let toastTimer;
export function toast(message, { actionLabel, onAction, duration = 5000 } = {}) {
  const root = $('#toast-root');
  render(root, html`<div class="toast" role="status">
    <span>${message}</span>
    ${actionLabel ? html`<button class="toast-action" type="button">${actionLabel}</button>` : ''}
  </div>`);
  const el = root.firstElementChild;
  requestAnimationFrame(() => el.classList.add('show'));
  if (actionLabel) {
    $('.toast-action', el).addEventListener('click', () => { onAction?.(); hide(); });
  }
  const hide = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, duration);
}

// ---- modal / bottom sheet ------------------------------------------------

export function openModal(title, body, { onClose } = {}) {
  const root = $('#modal-root');
  render(root, html`<div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close()}</button></header>
      <div class="modal-body">${body}</div>
    </div>
  </div>`);
  const backdrop = root.firstElementChild;
  requestAnimationFrame(() => backdrop.classList.add('show'));
  const close = () => {
    backdrop.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { if (root.firstElementChild === backdrop) root.innerHTML = ''; }, 200);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  on(backdrop, 'click', '[data-close]', close);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  return { el: $('.modal-body', backdrop), close };
}
