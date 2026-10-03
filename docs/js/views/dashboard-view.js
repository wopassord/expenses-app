import { html, raw } from '../lib/dom.js';
import { money, money0, signedMoney, pct } from '../lib/format.js';
import { MACROS, CATEGORIES, SOURCES, categoriesOf, macroColor, categoryColor, categoryLabel } from '../models/catalog.js';
import { dayLabel, monthLabel } from '../lib/dates.js';
import { dot, deltaBadge, categoryTag, sourcePill, emptyState, icons } from './components.js';

// ---- KPI tiles -----------------------------------------------------------

function tile(label, value, foot, extra = '', key = '') {
  return html`<div class="tile" data-kpi="${key}">
    <div class="tile-label">${label}</div>
    <div class="tile-value">${value}</div>
    ${extra}
    <div class="tile-foot">${foot}</div>
  </div>`;
}

function kpis({ summary: s, avg, projection: p }) {
  const spentExtra = s.isCurrent
    ? (avg ? html`<div class="tile-sub">Typical month ${money0(avg.total)}</div>` : '')
    : (avg ? html`<div class="tile-sub">${deltaBadge(s.spend.total, avg.total)} vs avg ${money0(avg.total)}</div>` : '');

  const surplus = p
    ? tile('Projected surplus', signedMoney(p.endSurplus),
      html`So far ${signedMoney(s.surplus)}${p.salaryPending ? ' · salary not in yet' : ''}`,
      html`<div class="tile-sub">${surplusBadge(p.endSurplus)}</div>`, 'surplus')
    : tile('Surplus', signedMoney(s.surplus), html`Income ${money0(s.income.total)} − own spending ${money0(s.spend.own)}`,
      html`<div class="tile-sub">${surplusBadge(s.surplus)}</div>`, 'surplus');

  return html`<section class="kpis">
    ${tile('Spent this month', money(s.spend.total), html`Own ${money0(s.spend.own)} · Parents’ card ${money0(s.spend.card)}`, spentExtra)}
    ${tile('From your parents', money(s.parents), html`Allowance ${money0(s.income.allowance)} + card ${money0(s.spend.card)}`)}
    ${surplus}
    ${tile('Daily pace', html`${money(s.perDay)}<small>/day</small>`,
      s.isCurrent ? html`${s.daysInMonth - s.daysElapsed} days left${avg ? html` · avg ${money(avg.perDay)}/day` : ''}`
        : (avg ? html`Avg ${money(avg.perDay)}/day` : html`${s.daysInMonth} days`))}
  </section>`;
}

const surplusBadge = (v) => (v >= 0
  ? html`<span class="status status-good">${icons.check()} Saving</span>`
  : html`<span class="status status-bad">! Overspending</span>`);

// ---- Where it went (nested donut + legend) ------------------------------

export function donutData(spend) {
  const macros = Object.entries(spend.byMacro).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const inner = [], outer = [];
  for (const [m, v] of macros) {
    inner.push({ label: MACROS[m].label, value: v, color: macroColor(m) });
    for (const c of categoriesOf(m)) {
      const cv = spend.byCategory[c] ?? 0;
      if (cv > 0) outer.push({ label: CATEGORIES[c].label, value: cv, color: categoryColor(c) });
    }
  }
  return { inner, outer, total: spend.total, macros };
}

function whereItWent({ summary: s }) {
  if (s.spend.total <= 0) return html`<section class="card"><h3>Where it went</h3>${emptyState('Nothing spent yet', 'Add your first expense above — it will show up here.')}</section>`;
  const { macros } = donutData(s.spend);
  return html`<section class="card">
    <header class="card-head"><h3>Where it went</h3><span class="muted">100% = ${money0(s.spend.total)}</span></header>
    <div class="donut-layout">
      <div class="donut-wrap"><canvas id="donut" aria-label="Spending by category"></canvas>
        <div class="donut-center"><span class="muted">Spent</span><strong>${money0(s.spend.total)}</strong></div>
      </div>
      <ul class="legend">
        ${macros.map(([m, v]) => html`<li class="legend-macro">
          <div class="legend-row"><span>${dot(macroColor(m))}<b>${MACROS[m].label}</b></span><span class="num">${money(v)}</span><span class="num muted">${pct(v / s.spend.total)}</span></div>
          ${categoriesOf(m).filter((c) => (s.spend.byCategory[c] ?? 0) > 0).map((c) => html`
            <div class="legend-row legend-cat"><span>${dot(categoryColor(c))}${CATEGORIES[c].label}</span><span class="num">${money(s.spend.byCategory[c])}</span><span class="num muted">${pct(s.spend.byCategory[c] / s.spend.total)}</span></div>`)}
        </li>`)}
      </ul>
    </div>
  </section>`;
}

// ---- Money in vs out (HTML bars, card spending shown on both sides) ------

function flowRow(label, segments, scale) {
  return html`<div class="flow-row">
    <div class="flow-label">${label}</div>
    <div class="flow-bar">
      ${segments.filter((g) => g.value > 0).map((g) => html`<span class="flow-seg ${g.cls}" style="width:${(g.value / scale) * 100}%" title="${g.label}: ${money(g.value)}"></span>`)}
    </div>
    <div class="flow-keys">
      ${segments.filter((g) => g.value > 0).map((g) => html`<span class="flow-key"><i class="key ${g.cls}"></i>${g.label} <b>${money0(g.value)}</b></span>`)}
    </div>
  </div>`;
}

function moneyFlow({ summary: s, projection: p, settings }) {
  const pendingSalary = p?.salaryPending ? Number(settings.salary.amount) : 0;
  const inSegs = [
    { label: 'Salary', value: s.income.salary, cls: 'seg-salary' },
    { label: 'Salary (expected)', value: pendingSalary, cls: 'seg-expected' },
    { label: 'Parents’ allowance', value: s.income.allowance, cls: 'seg-parents' },
    { label: 'Other income', value: s.income.other, cls: 'seg-other' },
    { label: 'Paid by parents’ card', value: s.spend.card, cls: 'seg-card' },
  ];
  const outSegs = [
    { label: 'Your spending', value: Math.max(0, s.spend.own), cls: 'seg-own' },
    { label: 'Parents’ card', value: s.spend.card, cls: 'seg-card' },
  ];
  const inTotal = inSegs.reduce((a, g) => a + g.value, 0);
  const outTotal = outSegs.reduce((a, g) => a + g.value, 0);
  const scale = Math.max(inTotal, outTotal, 1);
  return html`<section class="card">
    <header class="card-head"><h3>Money in vs out</h3><span class="muted">${monthLabel(s.month)}</span></header>
    ${flowRow('In', inSegs, scale)}
    ${flowRow('Out', outSegs, scale)}
    <div class="flow-result">
      <span>Left over ${p?.salaryPending ? '(incl. expected salary)' : ''}</span>
      <strong class="${s.surplus + pendingSalary >= 0 ? 'pos' : 'neg'}">${signedMoney(s.surplus + pendingSalary)}</strong>
    </div>
    <p class="hint">Card purchases appear on both sides: your parents pay them, so they never eat into your surplus.</p>
  </section>`;
}

// ---- Categories vs average ----------------------------------------------

function categoryTable({ summary: s, avg, settings }) {
  const cats = Object.keys(CATEGORIES)
    .map((c) => ({ c, cur: s.spend.byCategory[c] ?? 0, avg: avg?.byCategory[c] ?? 0, budget: Number(settings.budgets[c]) || 0 }))
    .filter((r) => r.cur > 0 || r.avg > 0 || r.budget > 0)
    .sort((a, b) => b.cur - a.cur || b.avg - a.avg);

  if (!cats.length) return html`<section class="card"><h3>Categories</h3>${emptyState('No history yet', 'Averages appear after your first full month.')}</section>`;

  return html`<section class="card">
    <header class="card-head"><h3>Categories</h3><span class="muted">${avg ? `avg of ${avg.count} month${avg.count > 1 ? 's' : ''}` : 'no full month yet'}</span></header>
    <table class="cat-table">
      <thead><tr><th>Category</th><th class="num">This month</th><th class="num">Avg / month</th><th class="bar-col">${s.isCurrent ? 'Of typical / budget' : 'vs avg'}</th></tr></thead>
      <tbody>
        ${cats.map((r) => {
          const ref = r.budget || r.avg;
          const ratio = ref ? r.cur / ref : 0;
          const indicator = s.isCurrent || r.budget
            ? html`<div class="meter ${ratio > 1 ? 'over' : ''}" title="${r.budget ? 'Budget' : 'Typical month'} ${money0(ref)}">
                <span style="width:${Math.min(100, ratio * 100)}%"></span></div>
                <span class="meter-txt ${ratio > 1 ? 'neg' : ''}">${ref ? pct(ratio) : '—'}${r.budget ? html` <small>of budget</small>` : ''}</span>`
            : deltaBadge(r.cur, r.avg);
          return html`<tr>
            <td>${categoryTag(r.c)}</td>
            <td class="num">${r.cur ? money(r.cur) : html`<span class="muted">—</span>`}</td>
            <td class="num muted">${r.avg ? money(r.avg) : '—'}</td>
            <td class="bar-col"><div class="meter-cell">${indicator}</div></td>
          </tr>`;
        })}
      </tbody>
    </table>
  </section>`;
}

// ---- Projection (current month) -----------------------------------------

export function projectionBody(p) {
  const slider = (name, label, value, max, step, unit) => html`
    <label class="slider">
      <span class="slider-top"><span>${label}</span><output>${unit(value)}</output></span>
      <input type="range" name="${name}" min="0" max="${max}" step="${step}" value="${value}">
    </label>`;
  return html`
    <div class="sliders">
      ${slider('canteenMealsPerWeek', 'Canteen meals / week', p.params.canteenMealsPerWeek, 10, 1,
        (v) => `${v} × ${money(p.canteenTicket)}`)}
      ${slider('groceriesPerWeek', 'Groceries / week', p.params.groceriesPerWeek, 250, 5, (v) => money0(v))}
      ${slider('otherPerDay', 'Everything else / day', p.params.otherPerDay, 60, 1, (v) => money0(v))}
    </div>
    <table class="proj-table">
      <tbody>
        ${p.lines.filter((l) => l.amount > 0).map((l) => html`<tr>
          <td>${l.label}${l.recurring ? html` <span class="pill">recurring</span>` : ''}</td>
          <td class="num">${money0(l.amount)}</td></tr>`)}
        <tr class="sum"><td>Still to spend (${p.daysLeft} days)</td><td class="num">${money0(p.projectedTotal)}</td></tr>
        <tr><td class="muted">of which on parents’ card</td><td class="num muted">${money0(p.projectedCard)}</td></tr>
      </tbody>
    </table>
    <div class="proj-result">
      <div><span class="muted">Month total</span><strong>${money0(p.endSpendTotal)}</strong></div>
      <div><span class="muted">Expected income</span><strong>${money0(p.expectedIncome)}</strong></div>
      <div><span class="muted">End-of-month surplus</span><strong class="${p.endSurplus >= 0 ? 'pos' : 'neg'}">${signedMoney(p.endSurplus)}</strong></div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-projection">Reset to my averages</button>`;
}

function projectionCard({ projection: p, summary: s }) {
  if (!p) {
    return html`<section class="card">
      <header class="card-head"><h3>Month result</h3></header>
      <div class="proj-result">
        <div><span class="muted">Income</span><strong>${money0(s.income.total)}</strong></div>
        <div><span class="muted">Own spending</span><strong>${money0(s.spend.own)}</strong></div>
        <div><span class="muted">Surplus</span><strong class="${s.surplus >= 0 ? 'pos' : 'neg'}">${signedMoney(s.surplus)}</strong></div>
      </div>
      <p class="hint">Projections are available for the current month.</p>
    </section>`;
  }
  return html`<section class="card" id="projection-card">
    <header class="card-head"><h3>Savings potential</h3><span class="muted">based on your last ${p.windowDays} days</span></header>
    <div id="projection-body">${projectionBody(p)}</div>
  </section>`;
}

// ---- Parents' fund ------------------------------------------------------

function parentsCard({ plan }) {
  if (!plan) {
    return html`<section class="card"><h3>Parents’ money</h3>
      ${emptyState('No plan configured', 'Set the parents’ plan and the savings opening balance in Settings.')}</section>`;
  }
  const ahead = plan.ahead >= 0;
  return html`<section class="card">
    <header class="card-head"><h3>Parents’ money</h3><span class="muted">Savings balance vs plan</span></header>
    <div class="plan-stats">
      <div><span class="muted">Balance now</span><strong>${money0(plan.balance)}</strong></div>
      <div><span class="muted">Plan says</span><strong>${money0(plan.planNow)}</strong></div>
      <div><span class="muted">${ahead ? 'Ahead of plan' : 'Behind plan'}</span>
        <strong class="${ahead ? 'pos' : 'neg'}">${signedMoney(plan.ahead)}</strong></div>
    </div>
    <div class="chart-box chart-plan"><canvas id="plan-chart" aria-label="Savings balance against plan"></canvas></div>
    <p class="hint">${plan.runsOut
      ? html`At the pace since ${dayLabel(plan.start)}, savings last until <b>${dayLabel(plan.runsOut)}</b>.`
      : 'Savings are not going down.'}
      <span class="legend-inline"><i class="key seg-plan"></i>Plan <i class="key seg-actual"></i>Actual</span></p>
  </section>`;
}

// ---- Recurring + top expenses ------------------------------------------

function sideCard({ pending, top, summary: s }) {
  return html`<section class="card">
    ${s.isCurrent && pending.length ? html`
      <header class="card-head"><h3>Due this month</h3>
        <button class="btn btn-ghost btn-sm" data-action="confirm-all">${icons.check()} Confirm all</button></header>
      <ul class="rows">
        ${pending.map((r) => html`<li class="row">
          <span class="row-main">${categoryTag(r.category)}<span class="row-desc">${r.description}</span></span>
          <span class="muted small">day ${r.day || 1} · ${SOURCES[r.source]?.short}</span>
          <span class="num">${money(r.amount)}</span>
          <button class="btn btn-ghost btn-sm" data-action="confirm" data-id="${r.id}">Confirm</button>
        </li>`)}
      </ul>` : ''}
    <header class="card-head"><h3>Biggest expenses</h3></header>
    ${top.length ? html`<ul class="rows">
      ${top.map((t) => html`<li class="row clickable" data-edit="${t.id}">
        <span class="row-main">${categoryTag(t.category)}<span class="row-desc">${t.description}</span></span>
        <span class="muted small">${dayLabel(t.date)}</span>${sourcePill(t)}
        <span class="num">${money(t.amount)}</span>
      </li>`)}
    </ul>` : emptyState('Nothing here yet', 'Your largest expenses of the month will show up here.')}
  </section>`;
}

export function dashboardView(model) {
  return html`<div class="dash">
    ${kpis(model)}
    <div class="grid-2">${whereItWent(model)}${moneyFlow(model)}</div>
    <div class="grid-2">${categoryTable(model)}${projectionCard(model)}</div>
    <div class="grid-2">${parentsCard(model)}${sideCard(model)}</div>
  </div>`;
}
