import { render, on, $, debounce, html } from '../lib/dom.js';
import { macroOf } from '../models/catalog.js';
import { filtersView, listView } from '../views/transactions-view.js';

export class TransactionsController {
  constructor(app) {
    this.app = app;
    this.filters = { q: '', scope: 'month', type: '', source: '', category: '' };
  }

  #filtered() {
    const f = this.filters;
    const q = f.q.trim().toLowerCase();
    return this.app.repo.transactions.filter((t) =>
      (f.scope === 'all' || t.date.startsWith(this.app.month))
      && (!f.type || t.type === f.type)
      && (!f.source || t.source === f.source || t.toSource === f.source)
      && (!f.category || (f.category.startsWith('macro:') ? t.category && macroOf(t.category) === f.category.slice(6) : t.category === f.category))
      && (!q || t.description.toLowerCase().includes(q)));
  }

  render(root) {
    render(root, html`${filtersView(this.filters, this.app.month)}<div id="tx-results"></div>`);
    this.#renderList(root);

    const update = (e) => { this.filters[e.target.name] = e.target.value; this.#renderList(root); };
    const filters = $('.filters', root);
    filters.addEventListener('change', update);
    filters.addEventListener('input', debounce((e) => { if (e.target.name === 'q') update(e); }, 120));

    on(root, 'click', '[data-action]', (e, btn) => {
      const tx = this.app.repo.find(btn.dataset.id);
      if (!tx) return;
      if (btn.dataset.action === 'delete') this.app.deleteTransaction(tx);
      if (btn.dataset.action === 'duplicate') this.app.duplicateTransaction(tx);
    });
    on(root, 'click', '[data-edit]', (e, row) => {
      if (!e.target.closest('[data-action]')) this.app.editTransaction(row.dataset.edit);
    });
    on(root, 'keydown', '[data-edit]', (e, row) => { if (e.key === 'Enter' && e.target === row) this.app.editTransaction(row.dataset.edit); });
  }

  #renderList(root) {
    render($('#tx-results', root), listView(this.#filtered()));
  }
}
