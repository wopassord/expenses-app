import { todayISO, monthOf, daysInMonth, addDays, daysBetween } from '../lib/dates.js';
import { spendValue, isOwn, monthSummary } from './stats.js';
import { pendingRecurring } from './recurring.js';

// Deterministic end-of-month projection for the current month.
// Rates come from your own last 90 days; the three knobs (canteen meals per
// week, groceries per week, everything-else per day) can be overridden to
// answer "what if I…". Each bucket keeps its historical share paid with the
// parents' card, because that share doesn't come out of your surplus.

const WINDOW_DAYS = 90;
const LUMPY = new Set(['canteen', 'groceries', 'rent', 'subscriptions', 'travel']);

function bucket(txs, pred) {
  let total = 0, card = 0, count = 0;
  for (const t of txs) {
    if (!pred(t)) continue;
    const v = spendValue(t);
    total += v;
    if (!isOwn(t)) card += v;
    if (t.type === 'expense') count++;
  }
  return { total, count, cardShare: total > 0 ? card / total : 0 };
}

export function projectMonth(all, settings, month, overrides = {}) {
  const today = todayISO();
  if (month !== monthOf(today)) return null;

  const daysLeft = daysInMonth(month) - Number(today.slice(8));
  const weeksLeft = daysLeft / 7;

  const oldest = all.length ? all[all.length - 1].date : today;
  const from = [addDays(today, -WINDOW_DAYS), oldest].sort().pop();
  const windowDays = Math.max(7, daysBetween(from, today) + 1);
  const history = all.filter((t) => t.date >= from && t.date <= today);

  const canteen = bucket(history, (t) => t.category === 'canteen');
  const groceries = bucket(history, (t) => t.category === 'groceries');
  const rest = bucket(history, (t) => t.category && !LUMPY.has(t.category) && !t.recurringId);
  const canteenTicket = canteen.count ? canteen.total / canteen.count : 0;

  const defaults = {
    canteenMealsPerWeek: Number(settings.projection.canteenMealsPerWeek) || 0,
    groceriesPerWeek: Math.round(groceries.total / (windowDays / 7)),
    otherPerDay: Math.round(rest.total / windowDays),
  };
  const p = { ...defaults, ...overrides };

  const lines = [
    { key: 'canteen', label: 'Canteen', amount: canteenTicket * p.canteenMealsPerWeek * weeksLeft, cardShare: canteen.cardShare },
    { key: 'groceries', label: 'Groceries', amount: p.groceriesPerWeek * weeksLeft, cardShare: groceries.cardShare },
    { key: 'other', label: 'Everything else', amount: p.otherPerDay * daysLeft, cardShare: rest.cardShare },
    ...pendingRecurring(all, settings, month)
      .filter((r) => (r.type || 'expense') === 'expense')
      .map((r) => ({ key: `rec:${r.id}`, label: r.description, amount: Number(r.amount) || 0, cardShare: r.source === 'parents_cc' ? 1 : 0, recurring: true })),
  ];

  const projectedTotal = lines.reduce((s, l) => s + l.amount, 0);
  const projectedOwn = lines.reduce((s, l) => s + l.amount * (1 - l.cardShare), 0);

  const summary = monthSummary(all, settings, month);
  const salaryPending = summary.income.salary === 0 && Number(settings.salary.amount) > 0;
  const expectedIncome = summary.income.total + (salaryPending ? Number(settings.salary.amount) : 0);

  return {
    params: p, defaults, lines, daysLeft, weeksLeft, canteenTicket, windowDays,
    salaryPending, expectedIncome,
    projectedTotal, projectedOwn, projectedCard: projectedTotal - projectedOwn,
    endSpendTotal: summary.spend.total + projectedTotal,
    endSpendOwn: summary.spend.own + projectedOwn,
    endSurplus: expectedIncome - (summary.spend.own + projectedOwn),
  };
}
