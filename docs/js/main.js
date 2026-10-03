import { render, $, $$, on, html } from './lib/dom.js';
import { currentMonth, addMonths, monthLabel, monthOf, todayISO } from './lib/dates.js';
import { GitHubStore, LocalStore } from './repositories/stores.js';
import { DataRepository } from './repositories/data-repository.js';
import { createTransaction } from './models/transaction.js';
import { TransactionFormController } from './controllers/form-controller.js';
import { DashboardController } from './controllers/dashboard-controller.js';
import { TransactionsController } from './controllers/transactions-controller.js';
import { HistoryController } from './controllers/history-controller.js';
import { SettingsController } from './controllers/settings-controller.js';
import { setupView } from './views/setup-view.js';
import { openModal, toast } from './views/components.js';
import { destroyCharts } from './views/charts.js';
import { demoData } from './services/demo-data.js';

const CONNECTION_KEY = 'connection';
const ROUTES = ['dashboard', 'transactions', 'history', 'settings'];
const MONTH_ROUTES = new Set(['dashboard', 'transactions']);

function loadConnection() {
  try { return JSON.parse(localStorage.getItem(CONNECTION_KEY)); } catch { return null; }
}

class App {
  constructor() {
    this.month = currentMonth();
    this.controllers = {
      dashboard: new DashboardController(this),
      transactions: new TransactionsController(this),
      history: new HistoryController(this),
      settings: new SettingsController(this),
    };
  }

  start() {
    const conn = loadConnection();
    if (conn) this.#connect(conn); else this.#showSetup();
  }

  // ---- connection -------------------------------------------------------

  #showSetup(state = {}) {
    $('#app').hidden = true;
    const root = $('#setup');
    root.hidden = false;
    render(root, setupView(state));

    $('#connect-form', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const conn = { kind: 'github', owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim(), branch: 'main' };
      if (!conn.owner || !conn.repo || !conn.token) return this.#showSetup({ ...conn, error: 'Fill in all three fields' });
      render(root, setupView({ ...conn, busy: true }));
      try {
        await new GitHubStore(conn).check();
      } catch (err) {
        return this.#showSetup({ ...conn, error: err.message });
      }
      localStorage.setItem(CONNECTION_KEY, JSON.stringify(conn));
      this.#connect(conn);
    });

    on(root, 'click', '[data-action=demo]', async () => {
      const store = new LocalStore('demo');
      if (!(await store.read('config.json'))) await seedDemo(store);
      localStorage.setItem(CONNECTION_KEY, JSON.stringify({ kind: 'demo' }));
      this.#connect({ kind: 'demo' });
    });
  }

  #connect(conn) {
    this.conn = conn;
    const store = conn.kind === 'github' ? new GitHubStore(conn) : new LocalStore('demo');
    this.repo = new DataRepository(store);

    $('#setup').hidden = true;
    $('#app').hidden = false;
    document.body.classList.toggle('is-demo', conn.kind === 'demo');

    let queued = false;
    this.repo.addEventListener('change', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; this.#onDataChange(); });
    });
    this.repo.addEventListener('status', () => this.#renderStatus());

    this.#bindShell();
    this.#mountQuickAdd();
    this.#route();
    this.#renderStatus();
    this.repo.load();
  }

  connectionLabel() {
    return this.conn.kind === 'github'
      ? `Connected to github.com/${this.conn.owner}/${this.conn.repo}. Every change is a commit there.`
      : 'Demo mode: data lives only in this browser.';
  }

  disconnect() {
    if (!confirm('Remove the connection from this device? Your data stays safe in the repository.')) return;
    localStorage.removeItem(CONNECTION_KEY);
    location.hash = '';
    location.reload();
  }

  // ---- shell ------------------------------------------------------------

  #bindShell() {
    addEventListener('hashchange', () => this.#route());
    on(document, 'click', '[data-month]', (e, btn) => {
      const step = btn.dataset.month;
      this.month = step === 'now' ? currentMonth() : addMonths(this.month, Number(step));
      this.refresh();
    });
    $('#fab').addEventListener('click', () => this.newTransaction());
    $('#sync').addEventListener('click', () => this.repo.retry());

    // "n" or "/" jumps to the quick-add bar.
    addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === '/') {
        e.preventDefault();
        if (getComputedStyle($('#quick-add')).display === 'none') this.newTransaction(); else this.quick.focus();
      }
    });

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.refresh());
  }

  #mountQuickAdd() {
    this.quick = new TransactionFormController($('#quick-add'), {
      repo: this.repo, mode: 'quick',
      onDone: (tx) => { if (monthOf(tx.date) !== this.month) { this.month = monthOf(tx.date); this.refresh(); } },
    });
    this.quick.mount();
  }

  get route() {
    const r = location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'dashboard';
  }

  #route() {
    const route = this.route;
    $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
    document.body.dataset.route = route;
    window.scrollTo({ top: 0 });
    this.refresh();
  }

  refresh() {
    const route = this.route;
    $('#month-label').textContent = monthLabel(this.month);
    $('#month-now').hidden = this.month === currentMonth();
    $('[data-month="1"]').disabled = this.month >= currentMonth();
    $('.month-switch').hidden = !MONTH_ROUTES.has(route);
    destroyCharts();
    this.controllers[route].render($('#view'));
  }

  #onDataChange() {
    this.quick?.refreshIndex();
    // Don't wipe a settings form the user is editing.
    if (this.route === 'settings' && $('[data-dirty]:not([hidden])')) return;
    // Keep focus/scroll when data arrives in the background.
    const y = window.scrollY;
    this.refresh();
    window.scrollTo({ top: y });
  }

  #renderStatus() {
    const { status, pendingCount, error } = this.repo;
    const label = {
      idle: pendingCount ? `${pendingCount} pending` : (this.conn.kind === 'demo' ? 'Demo' : 'Synced'),
      loading: 'Loading…', syncing: 'Saving…',
      offline: `Offline${pendingCount ? ` · ${pendingCount} pending` : ''}`,
      error: 'Sync error · retry',
    }[status];
    const pill = $('#sync');
    pill.dataset.status = status;
    pill.title = error || (status === 'offline' ? 'Changes are kept on this device and will be saved when you are back online' : '');
    render(pill, html`<span class="sync-dot"></span><span class="sync-text">${label}</span>`);
    if (status === 'error' && error) toast(error, { duration: 8000 });
  }

  // ---- transaction actions shared by all views ---------------------------

  newTransaction(prefill) {
    const modal = openModal(prefill ? 'Duplicate entry' : 'New entry', html`<div id="sheet-form"></div>`);
    const form = new TransactionFormController(modal.el.firstElementChild, {
      repo: this.repo, mode: 'quick', tx: prefill,
      onDone: () => modal.close(),
    });
    form.mount({ focus: !prefill });
  }

  editTransaction(id) {
    const tx = this.repo.find(id);
    if (!tx) return;
    const modal = openModal('Edit entry', html`<div id="edit-form"></div>`);
    new TransactionFormController(modal.el.firstElementChild, {
      repo: this.repo, mode: 'edit', tx,
      onDone: () => modal.close(),
      onDelete: () => { modal.close(); this.deleteTransaction(tx); },
      onDuplicate: (copy) => { modal.close(); setTimeout(() => this.duplicateTransaction(copy), 220); },
    }).mount();
  }

  duplicateTransaction(tx) {
    const { id, createdAt, updatedAt, recurringId, ...fields } = tx;
    this.newTransaction(createTransaction({ ...fields, date: todayISO() }));
  }

  deleteTransaction(tx) {
    this.repo.remove(tx.id);
    toast(`Deleted “${tx.description}”`, { actionLabel: 'Undo', onAction: () => this.repo.add(tx), duration: 7000 });
  }
}

async function seedDemo(store) {
  const { transactions, settings } = demoData();
  await store.write('config.json', { settings }, null);
  const byMonth = {};
  for (const t of transactions) (byMonth[monthOf(t.date)] ??= []).push(t);
  for (const [m, list] of Object.entries(byMonth)) await store.write(`transactions/${m}.json`, { version: 1, transactions: list }, null);
}

new App().start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
