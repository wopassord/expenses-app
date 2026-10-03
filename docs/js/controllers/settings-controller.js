import { render, on, $, html } from '../lib/dom.js';
import { settingsView, recurringRows } from '../views/settings-view.js';
import { toast } from '../views/components.js';
import { macroOf } from '../models/catalog.js';

const NUMERIC = /amount|payDay|total|monthly|months|openingBalance|canteenMealsPerWeek/;

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys[keys.length - 1]] = value;
}

export class SettingsController {
  constructor(app) { this.app = app; }

  render(root) {
    this.draft = structuredClone(this.app.repo.settings);
    render(root, settingsView(this.draft, { connection: this.app.connectionLabel() }));
    const form = $('form', root);
    const dirty = () => { $('[data-dirty]', form).hidden = false; };

    on(form, 'input', '[data-path]', (e, el) => {
      setPath(this.draft, el.dataset.path, NUMERIC.test(el.dataset.path) ? Number(el.value) : el.value);
      dirty();
    });

    on(form, 'input', '[data-budget]', (e, el) => {
      if (el.value === '') delete this.draft.budgets[el.dataset.budget];
      else this.draft.budgets[el.dataset.budget] = Number(el.value);
      dirty();
    });

    const recList = $('#rec-list', form);
    const rerenderRec = () => render(recList, html`${recurringRows(this.draft.recurring)}`);
    on(recList, 'input', '[data-rec]', (e, el) => {
      const r = this.draft.recurring[Number(el.closest('.rec-row').dataset.i)];
      const key = el.dataset.rec;
      r[key] = el.type === 'checkbox' ? el.checked : ['amount', 'day'].includes(key) ? Number(el.value) : el.value;
      if (key === 'type') {
        if (r.type === 'transfer') { delete r.category; r.toSource ??= 'savings'; } else { delete r.toSource; r.category ??= 'subscriptions'; }
        rerenderRec();
      }
      dirty();
    });

    on(form, 'click', '[data-action]', (e, btn) => {
      const action = btn.dataset.action;
      if (action === 'add-rec') {
        this.draft.recurring.push({
          id: crypto.randomUUID?.() ?? String(Date.now()),
          description: '', amount: 0, type: 'expense', category: 'subscriptions', source: 'salary', day: 1, active: true,
        });
        rerenderRec(); dirty();
        recList.lastElementChild?.querySelector('input')?.focus();
      }
      if (action === 'remove-rec') {
        this.draft.recurring.splice(Number(btn.closest('.rec-row').dataset.i), 1);
        rerenderRec(); dirty();
      }
      if (action === 'export') this.#exportCsv();
      if (action === 'disconnect') this.app.disconnect();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.draft.recurring = this.draft.recurring.filter((r) => r.description && r.amount > 0);
      this.app.repo.saveSettings(this.draft);
      $('[data-dirty]', form).hidden = true;
      toast('Settings saved');
    });
  }

  #exportCsv() {
    const rows = [['date', 'type', 'description', 'category', 'macro', 'source', 'to_source', 'amount']];
    for (const t of [...this.app.repo.transactions].reverse()) {
      rows.push([t.date, t.type, t.description, t.category ?? '', t.category ? macroOf(t.category) : '', t.source, t.toSource ?? '', t.amount.toFixed(2)]);
    }
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `expenses-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
