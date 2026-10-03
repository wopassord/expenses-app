import { html } from '../lib/dom.js';
import { money0, signedMoney } from '../lib/format.js';
import { MACROS, CATEGORIES, categoriesOf, macroColor } from '../models/catalog.js';
import { shortMonthLabel } from '../lib/dates.js';
import { dot, categoryTag, emptyState } from './components.js';

const cell = (v) => (v ? money0(v) : html`<span class="muted">—</span>`);

export function historyView({ months, summaries, avg, partial, macrosUsed }) {
  if (!months.length) return emptyState('No history yet', 'Add some transactions and come back.');

  const head = html`<tr><th></th>${months.map((m) => html`<th class="num">${shortMonthLabel(m)}${partial.has(m) ? '*' : ''}</th>`)}<th class="num avg-col">Avg</th></tr>`;

  const macroRows = macrosUsed.map((m) => {
    const cats = categoriesOf(m).filter((c) => summaries.some((s) => s.spend.byCategory[c]));
    return html`
      <tr class="macro-row"><th>${dot(macroColor(m))}${MACROS[m].label}</th>
        ${summaries.map((s) => html`<td class="num">${cell(s.spend.byMacro[m])}</td>`)}
        <td class="num avg-col">${cell(avg?.byMacro[m])}</td></tr>
      ${cats.map((c) => html`<tr class="cat-row"><td>${categoryTag(c)}</td>
        ${summaries.map((s) => html`<td class="num">${cell(s.spend.byCategory[c])}</td>`)}
        <td class="num avg-col">${cell(avg?.byCategory[c])}</td></tr>`)}`;
  });

  const footRow = (label, pick, avgValue, fmt = money0, cls = '') => html`<tr class="${cls}"><th>${label}</th>
    ${summaries.map((s) => html`<td class="num">${fmt(pick(s))}</td>`)}
    <td class="num avg-col">${avgValue == null ? '—' : fmt(avgValue)}</td></tr>`;

  return html`<div class="history">
    <section class="card">
      <header class="card-head"><h3>Spending per month</h3>
        <span class="legend-inline">${macrosUsed.map((m) => html`<span>${dot(macroColor(m))}${MACROS[m].label}</span>`)}
          ${avg ? html`<span><i class="key seg-plan"></i>Average</span>` : ''}</span>
      </header>
      <div class="chart-box chart-history"><canvas id="history-chart" aria-label="Monthly spending by macro category"></canvas></div>
    </section>
    <section class="card">
      <header class="card-head"><h3>Month by month</h3>
        <span class="muted">${avg ? `Avg = ${avg.count} full month${avg.count > 1 ? 's' : ''}` : 'Average appears after the first full month'}${partial.size ? ' · * partial month' : ''}</span></header>
      <div class="table-scroll">
        <table class="hist-table">
          <thead>${head}</thead>
          <tbody>${macroRows}</tbody>
          <tfoot>
            ${footRow('Total spending', (s) => s.spend.total, avg?.total, money0, 'total-row')}
            ${footRow('… on parents’ card', (s) => s.spend.card, avg?.card)}
            ${footRow('Income (incl. allowance)', (s) => s.income.total, avg?.income)}
            ${footRow('Surplus', (s) => s.surplus, avg?.surplus, signedMoney, 'total-row')}
          </tfoot>
        </table>
      </div>
    </section>
  </div>`;
}
