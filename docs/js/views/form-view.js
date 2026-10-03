import { html, raw } from '../lib/dom.js';
import { TYPES, SOURCES, categoryLabel } from '../models/catalog.js';
import { money } from '../lib/format.js';
import { categoryOptions, icons, dot } from './components.js';
import { categoryColor } from '../models/catalog.js';

const radio = (name, value, label, checked) => html`
  <label class="seg-opt"><input type="radio" name="${name}" value="${value}" ${checked ? raw('checked') : ''}><span>${label}</span></label>`;

export const sourceLabelFor = (type) =>
  ({ expense: 'Paid with', income: 'Received in', refund: 'Received in', transfer: 'From' })[type];

/** mode: 'quick' (inline bar / mobile sheet) or 'edit' (modal). */
export function txFormView(tx, { mode }) {
  const uid = `${mode}-${Math.random().toString(36).slice(2, 7)}`;
  const amount = tx.amount ? String(tx.amount.toFixed(2)) : '';
  return html`
  <form class="tx-form tx-form-${mode}" novalidate autocomplete="off">
    <div class="f f-type">
      <div class="seg" role="radiogroup" aria-label="Type">
        ${Object.entries(TYPES).map(([id, t]) => radio('type', id, t.label, tx.type === id))}
      </div>
    </div>
    <div class="f f-desc">
      <label class="f-label" for="f-desc-${uid}">Description</label>
      <input id="f-desc-${uid}" name="description" value="${tx.description}" placeholder="What was it?"
        spellcheck="false" autocapitalize="sentences" enterkeyhint="next"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="f-suggest-${uid}">
      <ul class="suggest" id="f-suggest-${uid}" role="listbox" hidden></ul>
    </div>
    <div class="f f-amount">
      <label class="f-label" for="f-amount-${uid}">Amount</label>
      <div class="amount-wrap">
        <input id="f-amount-${uid}" name="amount" value="${amount}" inputmode="decimal" placeholder="0.00" enterkeyhint="done">
        <span class="unit">€</span>
      </div>
    </div>
    <div class="f f-cat" ${tx.type === 'transfer' ? raw('hidden') : ''}>
      <label class="f-label" for="f-cat-${uid}">Category</label>
      <select id="f-cat-${uid}" name="category">${categoryOptions(tx.type, tx.category)}</select>
    </div>
    <div class="f f-src">
      <span class="f-label" data-source-label>${sourceLabelFor(tx.type)}</span>
      <div class="seg seg-sm" role="radiogroup">
        ${Object.entries(SOURCES).map(([id, s]) => radio('source', id, s.short, tx.source === id))}
      </div>
    </div>
    <div class="f f-to" ${tx.type === 'transfer' ? '' : raw('hidden')}>
      <span class="f-label">To</span>
      <div class="seg seg-sm" role="radiogroup">
        ${Object.entries(SOURCES).filter(([id]) => id !== 'parents_cc').map(([id, s]) => radio('toSource', id, s.short, (tx.toSource || 'savings') === id))}
      </div>
    </div>
    <div class="f f-date">
      <label class="f-label" for="f-date-${uid}">Date</label>
      <input id="f-date-${uid}" type="date" name="date" value="${tx.date}" required>
    </div>
    <p class="form-error" role="alert" hidden></p>
    <div class="f-actions">
      ${mode === 'edit' ? html`
        <button type="button" class="btn btn-ghost btn-danger" data-action="delete">${icons.trash()} Delete</button>
        <button type="button" class="btn btn-ghost" data-action="duplicate">${icons.copy()} Duplicate</button>
        <span class="spacer"></span>
        <button type="submit" class="btn btn-primary">Save</button>`
      : html`<button type="submit" class="btn btn-primary btn-add">${icons.plus()}<span>Add</span></button>`}
    </div>
  </form>`;
}

export const suggestionItems = (items, active) => items.map((t, i) => html`
  <li role="option" data-i="${i}" class="${i === active ? 'active' : ''}" aria-selected="${i === active}">
    <span class="s-main">${dot(t.category && categoryColor(t.category) || 'var(--ink-3)')}${t.description}</span>
    <span class="s-meta">${t.type === 'transfer' ? 'Transfer' : categoryLabel(t.category)} · ${SOURCES[t.source]?.short} · ${money(t.amount)}</span>
  </li>`);
