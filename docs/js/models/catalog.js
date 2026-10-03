// Domain vocabulary: transaction types, money sources and the two-level
// category tree (macro → category). Macro colours are the validated
// categorical palette (CVD-checked in light and dark); categories are tints
// of their macro so every chart groups visually by macro.

export const TYPES = {
  expense:  { label: 'Expense',  sign: -1 },
  income:   { label: 'Income',   sign: +1 },
  refund:   { label: 'Refund',   sign: +1, hint: 'Money paid back to you (e.g. a friend’s share)' },
  transfer: { label: 'Transfer', sign: 0,  hint: 'Moving money between your own pockets' },
};

export const SOURCES = {
  salary:     { label: 'Salary',        short: 'Salary',  own: true },
  savings:    { label: 'Savings',       short: 'Savings', own: true },
  parents_cc: { label: 'Parents’ card', short: 'Card',    own: false },
};

export const MACROS = {
  housing:  { label: 'Housing',      icon: '🏠', color: { light: '#2a78d6', dark: '#3987e5' } },
  food:     { label: 'Food',         icon: '🍽', color: { light: '#eb6834', dark: '#d95926' } },
  fixed:    { label: 'Fixed & admin', icon: '📄', color: { light: '#1baf7a', dark: '#199e70' } },
  other:    { label: 'Other',        icon: '📦', color: { light: '#eda100', dark: '#c98500' } },
  personal: { label: 'Personal',     icon: '🧴', color: { light: '#e87ba4', dark: '#d55181' } },
  leisure:  { label: 'Leisure',      icon: '🎉', color: { light: '#4a3aa7', dark: '#9085e9' } },
};

export const CATEGORIES = {
  groceries:     { label: 'Groceries',     macro: 'food' },
  canteen:       { label: 'Canteen',       macro: 'food' },
  snacks:        { label: 'Snacks',        macro: 'food' },
  delivery:      { label: 'Delivery',      macro: 'food' },
  rent:          { label: 'Rent',          macro: 'housing' },
  utilities:     { label: 'Utilities',     macro: 'housing' },
  going_out:     { label: 'Going out',     macro: 'leisure' },
  travel:        { label: 'Travel',        macro: 'leisure' },
  personal_care: { label: 'Personal care', macro: 'personal' },
  health:        { label: 'Health',        macro: 'personal' },
  clothing:      { label: 'Clothing',      macro: 'personal' },
  admin:         { label: 'Admin',         macro: 'fixed' },
  subscriptions: { label: 'Subscriptions', macro: 'fixed' },
  misc:          { label: 'Misc',          macro: 'other' },
};

export const INCOME_CATEGORIES = {
  salary:       { label: 'Salary' },
  other_income: { label: 'Other income' },
};

export const MACRO_ORDER = Object.keys(MACROS);

export function categoriesOf(macro) {
  return Object.keys(CATEGORIES).filter((c) => CATEGORIES[c].macro === macro);
}

export function categoryLabel(id) {
  return CATEGORIES[id]?.label ?? INCOME_CATEGORIES[id]?.label ?? (id ? id : '—');
}

export const macroOf = (category) => CATEGORIES[category]?.macro ?? 'other';

// ---- colours -------------------------------------------------------------

export const theme = () =>
  (document.documentElement.dataset.theme
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

export const macroColor = (macro, t = theme()) => MACROS[macro]?.color[t] ?? '#898781';

function mix(hex, target, amount) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(target)];
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

/** Categories within a macro step from the full macro hue toward the surface. */
export function categoryColor(category, t = theme()) {
  const macro = macroOf(category);
  const siblings = categoriesOf(macro);
  const idx = Math.max(0, siblings.indexOf(category));
  const surface = t === 'dark' ? '#1a1a19' : '#fcfcfb';
  const steps = [0, 0.32, 0.52, 0.66];
  return mix(macroColor(macro, t), surface, steps[idx] ?? 0.7);
}
