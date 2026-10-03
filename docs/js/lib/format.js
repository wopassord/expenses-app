const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const money = (n) => eur.format(n || 0);
export const money0 = (n) => eur0.format(Math.round(n || 0));

export function signedMoney(n) {
  if (!n) return money(0);
  return (n > 0 ? '+' : '−') + money(Math.abs(n));
}

export const pct = (n) => `${Math.round(n * 100)}%`;

/** Accepts "7,10", "7.10", "1 234,5", "€ 12" … returns a number rounded to cents, or NaN. */
export function parseAmount(input) {
  let s = String(input ?? '').replace(/[€\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    // Whichever separator comes last is the decimal one.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const round2 = (n) => Math.round(n * 100) / 100;
