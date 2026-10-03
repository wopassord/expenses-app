import { createTransaction } from '../models/transaction.js';
import { dateInMonth } from '../lib/dates.js';
import { inMonth } from './stats.js';

// Recurring items (rent, subscriptions, a monthly top-up transfer…) are not
// created automatically: amounts drift, so the dashboard lists the ones still
// missing this month and you confirm them with one tap.

function alreadyRecorded(r, txs) {
  return txs.some((t) =>
    t.recurringId === r.id
    // Entries typed by hand (or imported) count too when they clearly match.
    || (!t.recurringId && t.type === (r.type || 'expense') && t.category === r.category && Math.abs(t.amount - r.amount) < 0.01));
}

export function pendingRecurring(all, settings, month) {
  const txs = inMonth(all, month);
  return settings.recurring
    .filter((r) => r.active !== false && !alreadyRecorded(r, txs))
    .sort((a, b) => (a.day || 1) - (b.day || 1));
}

export function transactionFromRecurring(r, month) {
  return createTransaction({
    type: r.type || 'expense',
    date: dateInMonth(month, Number(r.day) || 1),
    amount: r.amount,
    description: r.description,
    category: r.category,
    source: r.source,
    toSource: r.toSource,
    recurringId: r.id,
  });
}
