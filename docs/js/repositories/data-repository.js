import { ConflictError, OfflineError, AuthError } from './stores.js';
import { withDefaults } from '../models/settings.js';
import { monthOf } from '../lib/dates.js';

// Data layout in the store (one JSON file per month keeps files small and
// makes simultaneous edits from phone + computer rarely touch the same file):
//   config.json                  { settings }
//   transactions/YYYY-MM.json    { version, transactions: [...] }
//
// Every change is an *operation* (upsert / delete / config). Operations are
// applied optimistically to the local view, queued in localStorage, and then
// committed one by one: read the fresh file, apply the op, write it back with
// the sha we read. A stale sha means someone else wrote in between, so we
// re-read and re-apply. Ops are idempotent, so retrying is always safe.

const TX_DIR = 'transactions';
const CONFIG = 'config.json';
const txPath = (date) => `${TX_DIR}/${monthOf(date)}.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function opPath(op) {
  if (op.kind === 'config') return CONFIG;
  if (op.kind === 'upsert') return txPath(op.tx.date);
  return op.path;
}

function applyOp(data, op) {
  if (op.kind === 'config') return { settings: op.settings };
  const list = (data?.transactions ?? []).filter((t) => t.id !== (op.tx?.id ?? op.id));
  if (op.kind === 'upsert') list.push(op.tx);
  list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  return { version: 1, transactions: list };
}

function commitMessage(op) {
  if (op.kind === 'config') return 'settings: update';
  if (op.kind === 'delete') return `delete: ${op.label ?? op.id}`;
  return `${op.isNew ? 'add' : 'edit'}: ${op.tx.description} (${op.tx.amount.toFixed(2)} €)`;
}

export class DataRepository extends EventTarget {
  constructor(store) {
    super();
    this.store = store;
    this.status = 'idle';     // idle | loading | syncing | offline | error
    this.error = null;
    this.loaded = false;
    this.files = new Map();   // path → { data, sha } as last confirmed by the store
    this.queue = this.#readLocal('queue') ?? [];
    this.#chain = Promise.resolve();

    const snapshot = this.#readLocal('snapshot');
    if (snapshot) this.files = new Map(snapshot);
    this.#rebuild();

    addEventListener('online', () => this.#scheduleFlush());
  }

  #chain;
  #transactions = [];
  #pathById = new Map();
  #settings = withDefaults();

  // ---- public read API ---------------------------------------------------

  get transactions() { return this.#transactions; }
  get settings() { return this.#settings; }
  get pendingCount() { return this.queue.length; }
  get hasCache() { return this.files.size > 0; }
  find(id) { return this.#transactions.find((t) => t.id === id); }

  // ---- public write API --------------------------------------------------

  add(tx) { this.#enqueue({ kind: 'upsert', tx, isNew: true }); }

  update(tx) {
    const oldPath = this.#pathById.get(tx.id);
    if (oldPath && oldPath !== txPath(tx.date)) {
      this.#enqueue({ kind: 'delete', id: tx.id, path: oldPath, label: `${tx.description} (moved)` }, false);
    }
    this.#enqueue({ kind: 'upsert', tx });
  }

  remove(id) {
    const path = this.#pathById.get(id);
    const tx = this.find(id);
    if (path) this.#enqueue({ kind: 'delete', id, path, label: tx?.description });
  }

  saveSettings(settings) { this.#enqueue({ kind: 'config', settings }); }

  // ---- loading & syncing -------------------------------------------------

  async load() {
    this.#setStatus('loading');
    try {
      const names = await this.store.list(TX_DIR);
      const paths = [CONFIG, ...names.filter((n) => /^\d{4}-\d{2}\.json$/.test(n)).map((n) => `${TX_DIR}/${n}`)];
      const results = await Promise.all(paths.map(async (p) => [p, await this.store.read(p)]));
      this.files = new Map(results.filter(([, r]) => r));
      this.loaded = true;
      this.#saveSnapshot();
      this.#rebuild();
      this.#emitChange();
      this.#setStatus('idle');
      this.#scheduleFlush();
    } catch (e) {
      this.#handleError(e);
    }
  }

  retry() {
    if (!this.loaded) return this.load();
    this.#scheduleFlush();
  }

  #enqueue(op, flush = true) {
    this.queue.push(op);
    this.#writeLocal('queue', this.queue);
    this.#rebuild();
    this.#emitChange();
    if (flush) this.#scheduleFlush();
  }

  #scheduleFlush() {
    this.#chain = this.#chain.then(() => this.#flush());
  }

  async #flush() {
    while (this.queue.length) {
      this.#setStatus('syncing');
      try {
        await this.#commit(this.queue[0]);
      } catch (e) {
        this.#handleError(e);
        return;
      }
      this.queue.shift();
      this.#writeLocal('queue', this.queue);
      this.#saveSnapshot();
    }
    this.#rebuild();
    this.#emitChange();
    this.#setStatus('idle');
  }

  async #commit(op) {
    const path = opPath(op);
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await this.store.read(path);
      const next = applyOp(remote?.data, op);
      try {
        const sha = await this.store.write(path, next, remote?.sha, commitMessage(op));
        this.files.set(path, { data: next, sha });
        return;
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
        await sleep(400 * (attempt + 1)); // GitHub reads can lag a moment behind writes
      }
    }
    throw new Error('Could not save after several retries — try again in a moment');
  }

  #handleError(e) {
    if (e instanceof OfflineError) {
      this.error = null;
      this.#setStatus('offline');
    } else {
      this.error = e instanceof AuthError ? e.message : (e.message || String(e));
      this.#setStatus('error');
    }
  }

  // ---- derived view ------------------------------------------------------

  #rebuild() {
    const byId = new Map();
    const pathById = new Map();
    let config = this.files.get(CONFIG)?.data;

    for (const [path, file] of this.files) {
      if (!path.startsWith(`${TX_DIR}/`)) continue;
      for (const tx of file.data.transactions ?? []) { byId.set(tx.id, tx); pathById.set(tx.id, path); }
    }
    for (const op of this.queue) {
      if (op.kind === 'config') config = { settings: op.settings };
      else if (op.kind === 'delete') {
        if (pathById.get(op.id) === op.path) { byId.delete(op.id); pathById.delete(op.id); }
      } else { byId.set(op.tx.id, op.tx); pathById.set(op.tx.id, txPath(op.tx.date)); }
    }

    this.#transactions = [...byId.values()].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    this.#pathById = pathById;
    this.#settings = withDefaults(config?.settings);
  }

  #emitChange() { this.dispatchEvent(new Event('change')); }

  #setStatus(status) {
    if (status !== 'error') this.error = null;
    this.status = status;
    this.dispatchEvent(new Event('status'));
  }

  // ---- local persistence (cache + offline queue) -------------------------

  #saveSnapshot() { this.#writeLocal('snapshot', [...this.files]); }

  #readLocal(key) {
    try { return JSON.parse(localStorage.getItem(`${this.store.id}:${key}`)); } catch { return null; }
  }

  #writeLocal(key, value) {
    try { localStorage.setItem(`${this.store.id}:${key}`, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }
}
