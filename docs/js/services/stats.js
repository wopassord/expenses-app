import { SOURCES, macroOf } from '../models/catalog.js';
import { allowanceFor, parentsPlanMonths } from '../models/settings.js';
import { todayISO, monthOf, addMonths, daysInMonth, monthRange, daysBetween, addDays } from '../lib/dates.js';

// Pure functions over a transaction list. "Spending" is always net:
// expenses add, refunds subtract, income and transfers don't count.

export const inMonth = (txs, month) => txs.filter((t) => t.date.startsWith(month));

export function spendValue(t) {
  if (t.type === 'expense') return t.amount;
  if (t.type === 'refund') return -t.amount;
  return 0;
}

export const isOwn = (t) => SOURCES[t.source]?.own ?? true;

export function spendingBreakdown(txs) {
  const out = { total: 0, own: 0, card: 0, byCategory: {}, byMacro: {}, bySource: {} };
  for (const t of txs) {
    const v = spendValue(t);
    if (!v) continue;
    out.total += v;
    if (isOwn(t)) out.own += v; else out.card += v;
    out.byCategory[t.category] = (out.byCategory[t.category] ?? 0) + v;
    const macro = macroOf(t.category);
    out.byMacro[macro] = (out.byMacro[macro] ?? 0) + v;
    out.bySource[t.source] = (out.bySource[t.source] ?? 0) + v;
  }
  return out;
}

export function incomeBreakdown(txs, settings, month) {
  let salary = 0, other = 0;
  for (const t of txs) {
    if (t.type !== 'income') continue;
    if (t.category === 'salary') salary += t.amount; else other += t.amount;
  }
  const allowance = allowanceFor(settings, month);
  return { salary, other, allowance, total: salary + other + allowance };
}

export function monthSummary(all, settings, month) {
  const txs = inMonth(all, month);
  const spend = spendingBreakdown(txs);
  const income = incomeBreakdown(txs, settings, month);
  const today = todayISO();
  const cm = monthOf(today);
  const dim = daysInMonth(month);
  const daysElapsed = month < cm ? dim : month === cm ? Number(today.slice(8)) : 0;
  return {
    month, txs, spend, income,
    surplus: income.total - spend.own,
    parents: income.allowance + spend.card,
    daysElapsed, daysInMonth: dim,
    perDay: daysElapsed ? spend.total / daysElapsed : 0,
    isCurrent: month === cm, isPast: month < cm,
  };
}

/** Full months usable for averages: from settings.statsFrom (or first data) up to, not including, `before`. */
export function completedMonths(all, settings, before) {
  if (!all.length) return [];
  const oldest = monthOf(all[all.length - 1].date);
  const start = settings.statsFrom || oldest;
  const end = addMonths(before, -1);
  return start <= end ? monthRange(start, end) : [];
}

export function averages(all, settings, before) {
  const months = completedMonths(all, settings, before);
  if (!months.length) return null;
  const acc = { total: 0, own: 0, card: 0, surplus: 0, income: 0, days: 0, byCategory: {}, byMacro: {} };
  for (const m of months) {
    const s = monthSummary(all, settings, m);
    acc.total += s.spend.total; acc.own += s.spend.own; acc.card += s.spend.card;
    acc.surplus += s.surplus; acc.income += s.income.total; acc.days += s.daysInMonth;
    for (const [k, v] of Object.entries(s.spend.byCategory)) acc.byCategory[k] = (acc.byCategory[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.spend.byMacro)) acc.byMacro[k] = (acc.byMacro[k] ?? 0) + v;
  }
  const n = months.length;
  const div = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n]));
  return {
    months, count: n,
    total: acc.total / n, own: acc.own / n, card: acc.card / n,
    surplus: acc.surplus / n, income: acc.income / n,
    perDay: acc.total / acc.days,
    byCategory: div(acc.byCategory), byMacro: div(acc.byMacro),
  };
}

export const topExpenses = (txs, n = 5) =>
  txs.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, n);

// ---- Savings pocket & the parents' plan ----------------------------------

/** Effect of a transaction on the Savings pocket balance. */
function savingsEffect(t) {
  let v = 0;
  if (t.source === 'savings') v += t.type === 'income' || t.type === 'refund' ? t.amount : -t.amount;
  if (t.type === 'transfer' && t.toSource === 'savings') v += t.amount;
  return v;
}

/**
 * Savings balance over time against the plan "spend `monthly` per month of the
 * parents' money". The plan starts from the actual balance on the first plan
 * day, so own savings mixed into the account don't distort the comparison.
 */
export function parentsPlan(all, settings) {
  const months = parentsPlanMonths(settings);
  const { openingBalance, openingDate } = settings.savingsAccount;
  if (!months.length || !openingDate) return null;

  const start = `${months[0]}-01`;
  const end = `${addMonths(months[months.length - 1], 1)}-01`;
  const today = todayISO();
  const total = Number(settings.parents.total) || 0;
  const planDays = daysBetween(start, end);

  const relevant = all.filter((t) => t.date >= openingDate && savingsEffect(t) !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let balance = Number(openingBalance) || 0;
  let i = 0;
  while (i < relevant.length && relevant[i].date < start) balance += savingsEffect(relevant[i++]);
  const startBalance = balance;

  const actual = [{ x: 0, y: balance }];
  const last = today < end ? today : addDays(end, -1);
  while (i < relevant.length && relevant[i].date <= last) {
    const date = relevant[i].date;
    while (i < relevant.length && relevant[i].date === date) balance += savingsEffect(relevant[i++]);
    actual.push({ x: Math.max(0, daysBetween(start, date)), y: balance });
  }
  const todayX = Math.min(planDays, Math.max(0, daysBetween(start, today)));
  actual.push({ x: todayX, y: balance });

  const planAt = (x) => startBalance - total * (x / planDays);
  const plan = months.map((m) => ({ x: daysBetween(start, `${m}-01`), y: planAt(daysBetween(start, `${m}-01`)) }));
  plan.push({ x: planDays, y: startBalance - total });

  const spentPerDay = todayX > 0 ? (startBalance - balance) / todayX : 0;
  const runsOutInDays = spentPerDay > 0 ? balance / spentPerDay : Infinity;

  return {
    start, end, months, planDays, todayX, startBalance,
    actual, plan,
    ticks: [...months, addMonths(months[months.length - 1], 1)].map((m) => ({ x: daysBetween(start, `${m}-01`), month: m })),
    balance, planNow: planAt(todayX), ahead: balance - planAt(todayX),
    runsOut: Number.isFinite(runsOutInDays) ? addDays(today, Math.floor(runsOutInDays)) : null,
  };
}
