import { html, raw } from '../lib/dom.js';
import { money, signedMoney } from '../lib/format.js';
import { TYPES, SOURCES, MACROS, MACRO_ORDER, CATEGORIES, categoriesOf } from '../models/catalog.js';
import { dayLabel, monthLabel } from '../lib/dates.js';
import { categoryTag, sourcePill, signedAmount, icons, emptyState } from './components.js';
import { spendValue } from '../services/stats.js';

const opt = (value, label, selected) => html`<option value="${value}" ${value === selected ? raw('selected') : ''}>${label}</option>`;

export function filtersView(f, month) {
  return html`<div class="filters card">
    <input type="search" name="q" value="${f.q}" placeholder="Search descriptions…" aria-label="Search">
    <select name="scope" aria-label="Period">
      ${opt('month', monthLabel(month), f.scope)}${opt('all', 'All time', f.scope)}
    </select>
    <select name="type" aria-label="Type">
      ${opt('', 'All types', f.type)}${Object.entries(TYPES).map(([id, t]) => opt(id, t.label, f.type))}
    </select>
    <select name="source" aria-label="Source">
      ${opt('', 'All sources', f.source)}${Object.entries(SOURCES).map(([id, s]) => opt(id, s.label, f.source))}
    </select>
    <select name="category" aria-label="Category">
      ${opt('', 'All categories', f.category)}
      ${MACRO_ORDER.map((m) => html`<optgroup label="${MACROS[m].label}">
        ${opt(`macro:${m}`, `All ${MACROS[m].label}`, f.category)}
        ${categoriesOf(m).map((c) => opt(c, CATEGORIES[c].label, f.category))}
      </optgroup>`)}
    </select>
  </div>`;
}

export function listView(txs) {
  if (!txs.length) return emptyState('No transactions match', 'Try another filter, or add one with the bar above.');

  const spent = txs.reduce((s, t) => s + spendValue(t), 0);
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  const days = [];
  for (const t of txs) {
    const last = days[days.length - 1];
    if (last?.date === t.date) last.items.push(t); else days.push({ date: t.date, items: [t] });
  }

  return html`
    <div class="list-summary">
      <span>${txs.length} entr${txs.length === 1 ? 'y' : 'ies'}</span>
      <span>Net spending <b>${money(spent)}</b></span>
      ${income ? html`<span>Income <b>${money(income)}</b></span>` : ''}
    </div>
    <div class="tx-list card">
      ${days.map((d) => {
        const daySpend = d.items.reduce((s, t) => s + spendValue(t), 0);
        return html`<div class="tx-day">
          <div class="tx-day-head"><span>${dayLabel(d.date)}</span>${daySpend ? html`<span class="muted">${signedMoney(-daySpend)}</span>` : ''}</div>
          ${d.items.map((t) => html`<div class="tx-row" data-edit="${t.id}" tabindex="0" role="button" aria-label="Edit ${t.description}">
            <span class="tx-cat">${categoryTag(t.category)}</span>
            <span class="tx-desc">${t.description}${t.recurringId ? html` <span class="pill">recurring</span>` : ''}${t.type === 'refund' ? html` <span class="pill pill-pos">refund</span>` : ''}</span>
            <span class="tx-src">${sourcePill(t)}</span>
            <span class="tx-amt">${signedAmount(t)}</span>
            <span class="tx-actions">
              <button class="icon-btn" data-action="duplicate" data-id="${t.id}" title="Duplicate" aria-label="Duplicate">${icons.copy()}</button>
              <button class="icon-btn" data-action="delete" data-id="${t.id}" title="Delete" aria-label="Delete">${icons.trash()}</button>
            </span>
          </div>`)}
        </div>`;
      })}
    </div>`;
}
