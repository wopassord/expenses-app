import { TYPES, SOURCES, CATEGORIES, INCOME_CATEGORIES } from './catalog.js';
import { todayISO } from '../lib/dates.js';
import { round2 } from '../lib/format.js';

/**
 * Transaction entity.
 * {
 *   id, type: 'expense'|'income'|'refund'|'transfer',
 *   date: 'YYYY-MM-DD', amount: number (> 0, sign comes from type),
 *   description, category (expense/refund: CATEGORIES, income: INCOME_CATEGORIES, transfer: null),
 *   source (the pocket that pays / receives), toSource (transfer destination),
 *   recurringId?, createdAt, updatedAt
 * }
 */

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function createTransaction(fields = {}) {
  const now = new Date().toISOString();
  return normalize({
    id: newId(),
    type: 'expense',
    date: todayISO(),
    amount: 0,
    description: '',
    category: 'groceries',
    source: 'salary',
    createdAt: now,
    updatedAt: now,
    ...fields,
  });
}

export function normalize(tx) {
  const out = { ...tx, amount: round2(Number(tx.amount) || 0), description: String(tx.description ?? '').trim() };
  if (out.type === 'transfer') {
    out.category = null;
    out.toSource = out.toSource || (out.source === 'savings' ? 'salary' : 'savings');
  } else {
    delete out.toSource;
  }
  if (out.type === 'income' && !INCOME_CATEGORIES[out.category]) out.category = 'other_income';
  if ((out.type === 'expense' || out.type === 'refund') && !CATEGORIES[out.category]) out.category = 'misc';
  if (!out.recurringId) delete out.recurringId;
  return out;
}

/** Returns a map field → message; empty object when valid. */
export function validate(tx) {
  const errors = {};
  if (!TYPES[tx.type]) errors.type = 'Pick a type';
  if (!(tx.amount > 0)) errors.amount = 'Enter an amount above 0';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date || '')) errors.date = 'Pick a date';
  if (!tx.description) errors.description = 'Add a short description';
  if (!SOURCES[tx.source]) errors.source = 'Pick a source';
  if (tx.type === 'transfer' && tx.toSource === tx.source) errors.toSource = 'Pick a different destination';
  return errors;
}

export const touch = (tx) => ({ ...tx, updatedAt: new Date().toISOString() });
