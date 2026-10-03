import { html, raw } from '../lib/dom.js';
import { MACROS, MACRO_ORDER, CATEGORIES, SOURCES, categoriesOf } from '../models/catalog.js';
import { categoryOptions, sourceOptions, icons, dot } from './components.js';
import { macroColor, categoryColor } from '../models/catalog.js';

const field = (label, path, value, { type = 'number', step = '0.01', hint = '', min } = {}) => html`
  <label class="sfield">
    <span class="f-label">${label}</span>
    <input name="${path}" data-path="${path}" type="${type}" value="${value ?? ''}" ${type === 'number' ? raw(`step="${step}" inputmode="decimal"`) : ''} ${min != null ? raw(`min="${min}"`) : ''}>
    ${hint ? html`<small class="muted">${hint}</small>` : ''}
  </label>`;

export function recurringRows(list) {
  if (!list.length) return html`<p class="muted">No recurring items yet.</p>`;
  return list.map((r, i) => html`<div class="rec-row" data-i="${i}">
    <input data-rec="description" value="${r.description}" placeholder="Description" aria-label="Description">
    <input data-rec="amount" type="number" step="0.01" inputmode="decimal" value="${r.amount}" aria-label="Amount">
    <select data-rec="type" aria-label="Type">
      <option value="expense" ${r.type !== 'transfer' ? raw('selected') : ''}>Expense</option>
      <option value="transfer" ${r.type === 'transfer' ? raw('selected') : ''}>Transfer</option>
    </select>
    ${r.type === 'transfer'
      ? html`<select data-rec="toSource" aria-label="To">${sourceOptions(r.toSource || 'savings', 'parents_cc')}</select>`
      : html`<select data-rec="category" aria-label="Category">${categoryOptions('expense', r.category)}</select>`}
    <select data-rec="source" aria-label="${r.type === 'transfer' ? 'From' : 'Paid with'}">${sourceOptions(r.source)}</select>
    <input data-rec="day" type="number" min="1" max="31" value="${r.day || 1}" aria-label="Day of month" title="Day of month">
    <label class="check" title="Active"><input data-rec="active" type="checkbox" ${r.active !== false ? raw('checked') : ''}><span>on</span></label>
    <button type="button" class="icon-btn" data-action="remove-rec" aria-label="Remove">${icons.trash()}</button>
  </div>`);
}

export function settingsView(s, { connection }) {
  return html`<form class="settings" novalidate>
    <section class="card">
      <h3>Income</h3>
      <div class="sgrid">
        ${field('Monthly salary (€)', 'salary.amount', s.salary.amount, { hint: 'Used in projections until this month’s salary is recorded' })}
        ${field('Pay day', 'salary.payDay', s.salary.payDay, { step: '1', min: 1 })}
      </div>
    </section>

    <section class="card">
      <h3>Parents’ plan</h3>
      <div class="sgrid">
        ${field('Total given (€)', 'parents.total', s.parents.total)}
        ${field('Allowance per month (€)', 'parents.monthly', s.parents.monthly)}
        ${field('First month', 'parents.startMonth', s.parents.startMonth, { type: 'month' })}
        ${field('Number of months', 'parents.months', s.parents.months, { step: '1', min: 0 })}
      </div>
    </section>

    <section class="card">
      <h3>Savings account</h3>
      <p class="hint">Balance of the Savings pocket on a given date. Everything paid from or into Savings after that date moves it.</p>
      <div class="sgrid">
        ${field('Opening balance (€)', 'savingsAccount.openingBalance', s.savingsAccount.openingBalance)}
        ${field('On date', 'savingsAccount.openingDate', s.savingsAccount.openingDate, { type: 'date' })}
      </div>
    </section>

    <section class="card">
      <h3>Statistics & projection</h3>
      <div class="sgrid">
        ${field('Averages start at', 'statsFrom', s.statsFrom, { type: 'month', hint: 'Earlier (partial) months are excluded from averages' })}
        ${field('Canteen meals per week', 'projection.canteenMealsPerWeek', s.projection.canteenMealsPerWeek, { step: '1', min: 0 })}
      </div>
    </section>

    <section class="card">
      <header class="card-head"><h3>Recurring</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-action="add-rec">${icons.plus()} Add</button></header>
      <p class="hint">Listed on the dashboard each month until confirmed. A transfer (e.g. Salary → Savings) can model your share of the rent.</p>
      <div id="rec-list">${recurringRows(s.recurring)}</div>
    </section>

    <section class="card">
      <h3>Monthly budgets <small class="muted">(optional)</small></h3>
      <div class="budget-grid">
        ${MACRO_ORDER.map((m) => html`<div class="budget-group">
          <div class="budget-macro">${dot(macroColor(m))}${MACROS[m].label}</div>
          ${categoriesOf(m).map((c) => html`<label class="budget-item">
            <span>${dot(categoryColor(c))}${CATEGORIES[c].label}</span>
            <input data-budget="${c}" type="number" step="1" min="0" inputmode="decimal" value="${s.budgets[c] ?? ''}" placeholder="—">
          </label>`)}
        </div>`)}
      </div>
    </section>

    <section class="card">
      <h3>Data</h3>
      <p class="hint">${connection}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-action="export">Export CSV</button>
        <button type="button" class="btn btn-ghost btn-danger" data-action="disconnect">Disconnect this device</button>
      </div>
    </section>

    <div class="save-bar">
      <span class="muted" data-dirty hidden>Unsaved changes</span>
      <button type="submit" class="btn btn-primary">Save settings</button>
    </div>
  </form>`;
}
