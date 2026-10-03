// User settings, stored as config.json in the private data repo.
// Defaults are intentionally neutral: this file ships in a public repo, so no
// personal figures belong here.

export const DEFAULT_SETTINGS = {
  version: 1,
  salary: { amount: 0, payDay: 1 },
  parents: { total: 0, monthly: 0, startMonth: '', months: 0 },
  savingsAccount: { openingBalance: 0, openingDate: '' },
  statsFrom: '',
  projection: { canteenMealsPerWeek: 3 },
  recurring: [],   // [{ id, description, amount, category, source, day, active }]
  budgets: {},     // { categoryId: monthlyAmount }
};

export function withDefaults(cfg = {}) {
  const d = structuredClone(DEFAULT_SETTINGS);
  return {
    ...d,
    ...cfg,
    salary: { ...d.salary, ...cfg.salary },
    parents: { ...d.parents, ...cfg.parents },
    savingsAccount: { ...d.savingsAccount, ...cfg.savingsAccount },
    projection: { ...d.projection, ...cfg.projection },
    recurring: Array.isArray(cfg.recurring) ? cfg.recurring : [],
    budgets: cfg.budgets ?? {},
  };
}

/** Months covered by the parents' plan, e.g. ['2026-09', … '2027-02']. */
export function parentsPlanMonths(cfg) {
  const { startMonth, months } = cfg.parents;
  if (!startMonth || !months) return [];
  const [y, m] = startMonth.split('-').map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export const allowanceFor = (cfg, month) =>
  (parentsPlanMonths(cfg).includes(month) ? Number(cfg.parents.monthly) || 0 : 0);
