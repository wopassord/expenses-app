import { render, $, $$, on, html } from '../lib/dom.js';
import { parseAmount } from '../lib/format.js';
import { createTransaction, normalize, validate, touch } from '../models/transaction.js';
import { txFormView, suggestionItems, sourceLabelFor } from '../views/form-view.js';
import { categoryOptions, toast } from '../views/components.js';
import { buildIndex, suggest } from '../services/suggest.js';
import { todayISO } from '../lib/dates.js';

const lastSourceKey = (type) => `last-source:${type}`;
const rememberedSource = (type) => {
  try { return localStorage.getItem(lastSourceKey(type)); } catch { return null; }
};

/** A blank transaction pre-filled with today and the last source used. */
export function blankTransaction(type = 'expense') {
  const defaults = { expense: 'salary', income: 'salary', refund: 'savings', transfer: 'salary' };
  return createTransaction({
    type,
    category: type === 'income' ? 'salary' : 'groceries',
    source: rememberedSource(type) || defaults[type],
    date: todayISO(),
  });
}

/**
 * Drives one transaction form. In 'quick' mode it adds and resets; in 'edit'
 * mode it saves / deletes / duplicates the given transaction.
 */
export class TransactionFormController {
  constructor(root, { repo, mode = 'quick', tx, onDone, onDelete, onDuplicate }) {
    Object.assign(this, { root, repo, mode, onDone, onDelete, onDuplicate });
    this.tx = tx ?? blankTransaction();
    this.items = [];
    this.active = -1;
  }

  mount({ focus = false } = {}) {
    render(this.root, txFormView(this.tx, { mode: this.mode }));
    this.form = $('form', this.root);
    this.desc = $('[name=description]', this.form);
    this.list = $('.suggest', this.form);
    this.index = buildIndex(this.repo.transactions);
    this.#bind();
    if (focus) setTimeout(() => this.desc.focus(), 60);
  }

  /** Pick up entries added elsewhere (other form, other device) for autocomplete. */
  refreshIndex() { this.index = buildIndex(this.repo.transactions); }

  focus() { this.desc?.focus(); }

  #bind() {
    const f = this.form;
    on(f, 'change', '[name=type]', () => this.#onTypeChange());
    f.addEventListener('submit', (e) => { e.preventDefault(); this.#submit(); });

    this.desc.addEventListener('input', () => { this.active = -1; this.#refreshSuggestions(); });
    this.desc.addEventListener('blur', () => setTimeout(() => this.#closeSuggestions(), 120));
    this.desc.addEventListener('keydown', (e) => this.#onDescKey(e));
    on(this.list, 'mousedown', 'li', (e, li) => { e.preventDefault(); this.#apply(this.items[Number(li.dataset.i)]); });

    on(f, 'click', '[data-action]', (e, btn) => {
      if (btn.dataset.action === 'delete') this.onDelete?.(this.tx);
      if (btn.dataset.action === 'duplicate') this.onDuplicate?.(this.#read());
    });
  }

  // ---- reading / writing fields -----------------------------------------

  #value(name) {
    const el = this.form.elements[name];
    return el instanceof RadioNodeList ? el.value : el?.value;
  }

  #read() {
    const type = this.#value('type');
    return normalize({
      ...this.tx,
      type,
      description: this.#value('description'),
      amount: parseAmount(this.#value('amount')),
      category: type === 'transfer' ? null : this.#value('category'),
      source: this.#value('source'),
      toSource: this.#value('toSource'),
      date: this.#value('date'),
    });
  }

  #setRadio(name, value) {
    const input = $(`[name=${name}][value="${value}"]`, this.form);
    if (input) input.checked = true;
  }

  #onTypeChange() {
    const type = this.#value('type');
    const cat = $('[name=category]', this.form);
    const keep = cat.value;
    render(cat, html`${categoryOptions(type, keep)}`);
    if (type === 'income' && !['salary', 'other_income'].includes(keep)) cat.value = 'salary';
    $('.f-cat', this.form).hidden = type === 'transfer';
    $('.f-to', this.form).hidden = type !== 'transfer';
    $('[data-source-label]', this.form).textContent = sourceLabelFor(type);
    const remembered = rememberedSource(type);
    if (this.mode === 'quick' && remembered) this.#setRadio('source', remembered);
  }

  // ---- autocomplete -----------------------------------------------------

  #refreshSuggestions() {
    this.items = suggest(this.index, this.desc.value);
    if (!this.items.length) return this.#closeSuggestions();
    render(this.list, html`${suggestionItems(this.items, this.active)}`);
    this.list.hidden = false;
    this.desc.setAttribute('aria-expanded', 'true');
  }

  #closeSuggestions() {
    this.list.hidden = true;
    this.items = [];
    this.active = -1;
    this.desc.setAttribute('aria-expanded', 'false');
  }

  #onDescKey(e) {
    const open = !this.list.hidden && this.items.length;
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault(); this.active = (this.active + 1) % this.items.length; this.#refreshSuggestions();
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault(); this.active = (this.active - 1 + this.items.length) % this.items.length; this.#refreshSuggestions();
    } else if ((e.key === 'Enter' || e.key === 'Tab') && open && this.active >= 0) {
      e.preventDefault(); this.#apply(this.items[this.active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); this.#closeSuggestions();
    } else if (e.key === 'Enter' && !this.form.elements.amount.value) {
      // Typed something new: Enter moves on to the amount instead of failing validation.
      e.preventDefault(); this.#closeSuggestions(); this.form.elements.amount.focus();
    }
  }

  /** Fill the form from a past transaction, keeping today's date. */
  #apply(t) {
    this.#setRadio('type', t.type);
    this.#onTypeChange();
    this.desc.value = t.description;
    this.form.elements.amount.value = t.amount.toFixed(2);
    if (t.category) this.form.elements.category.value = t.category;
    this.#setRadio('source', t.source);
    if (t.toSource) this.#setRadio('toSource', t.toSource);
    this.#closeSuggestions();
    const amount = this.form.elements.amount;
    amount.focus();
    amount.select();
  }

  // ---- submit -----------------------------------------------------------

  #showError(errors) {
    const el = $('.form-error', this.form);
    const messages = Object.values(errors);
    el.hidden = !messages.length;
    el.textContent = messages[0] ?? '';
    $$('.f', this.form).forEach((f) => f.classList.remove('invalid'));
    for (const name of Object.keys(errors)) this.form.elements[name]?.closest?.('.f')?.classList.add('invalid');
    if (messages.length) {
      const first = Object.keys(errors)[0];
      const el2 = this.form.elements[first];
      (el2 instanceof RadioNodeList ? el2[0] : el2)?.focus();
    }
  }

  #submit() {
    const tx = this.#read();
    const errors = validate(tx);
    this.#showError(errors);
    if (Object.keys(errors).length) return;

    try { localStorage.setItem(lastSourceKey(tx.type), tx.source); } catch { /* ignore */ }

    if (this.mode === 'edit') {
      this.repo.update(touch(tx));
      toast('Saved');
      this.onDone?.(tx);
      return;
    }

    this.repo.add(tx);
    toast(`Added “${tx.description}”`, { actionLabel: 'Undo', onAction: () => this.repo.remove(tx.id) });
    // Reset for the next entry but keep type, source and date: entries come in batches.
    this.tx = { ...blankTransaction(tx.type), source: tx.source, date: tx.date, category: tx.category };
    this.desc.value = '';
    this.form.elements.amount.value = '';
    this.index = buildIndex(this.repo.transactions);
    this.onDone?.(tx);
    this.desc.focus();
  }
}
