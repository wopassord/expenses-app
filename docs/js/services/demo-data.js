import { createTransaction } from '../models/transaction.js';
import { todayISO, addDays, addMonths, currentMonth } from '../lib/dates.js';

// Made-up sample data for demo mode, generated around today's date.
export function demoData() {
  const today = todayISO();
  const start = addMonths(currentMonth(), -2);
  const txs = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const add = (date, type, description, amount, category, source) =>
    txs.push(createTransaction({ date, type, description, amount, category, source }));

  for (let d = `${start}-01`; d <= today; d = addDays(d, 1)) {
    const dow = new Date(`${d}T12:00`).getDay();
    const day = Number(d.slice(8));
    if (dow >= 1 && dow <= 5 && rnd() < 0.6) add(d, 'expense', 'Canteen lunch', 7.1 + Math.round(rnd() * 80) / 100, 'canteen', 'parents_cc');
    if (dow === 6) add(d, 'expense', 'Supermarket', 35 + Math.round(rnd() * 3000) / 100, 'groceries', rnd() < 0.5 ? 'parents_cc' : 'salary');
    if (rnd() < 0.12) add(d, 'expense', 'Drinks with friends', 8 + Math.round(rnd() * 2000) / 100, 'going_out', 'savings');
    if (rnd() < 0.06) add(d, 'expense', 'Delivery', 15 + Math.round(rnd() * 1000) / 100, 'delivery', 'parents_cc');
    if (rnd() < 0.08) add(d, 'expense', 'Coffee & snack', 2 + Math.round(rnd() * 400) / 100, 'snacks', 'salary');
    if (day === 5) add(d, 'expense', 'Rent', 720, 'rent', 'savings');
    if (day === 1) add(d, 'income', 'Salary', 1650, 'salary', 'salary');
    if (day === 12 && rnd() < 0.7) add(d, 'expense', 'Pharmacy', 12.5, 'health', 'salary');
    if (day === 20) add(d, 'expense', 'Clothes', 39.99, 'clothing', 'parents_cc');
  }
  return {
    transactions: txs,
    settings: {
      version: 1,
      salary: { amount: 1650, payDay: 1 },
      parents: { total: 2400, monthly: 400, startMonth: start, months: 6 },
      savingsAccount: { openingBalance: 2400, openingDate: `${start}-01` },
      statsFrom: start,
      projection: { canteenMealsPerWeek: 3 },
      recurring: [
        { id: 'rent', description: 'Rent', amount: 720, type: 'expense', category: 'rent', source: 'savings', day: 5, active: true },
        { id: 'gym', description: 'Gym', amount: 30, type: 'expense', category: 'subscriptions', source: 'salary', day: 1, active: true },
        { id: 'phone', description: 'Phone plan', amount: 5, type: 'expense', category: 'subscriptions', source: 'salary', day: 3, active: true },
      ],
      budgets: { going_out: 120 },
    },
  };
}
