import { render, on, $ } from '../lib/dom.js';
import { signedMoney } from '../lib/format.js';
import { shortMonthLabel } from '../lib/dates.js';
import { monthSummary, averages, topExpenses, parentsPlan } from '../services/stats.js';
import { projectMonth } from '../services/projection.js';
import { pendingRecurring, transactionFromRecurring } from '../services/recurring.js';
import { dashboardView, donutData, projectionBody } from '../views/dashboard-view.js';
import { nestedDonut, planChart } from '../views/charts.js';
import { toast } from '../views/components.js';

export class DashboardController {
  constructor(app) {
    this.app = app;
    this.overrides = {}; // projection what-ifs, kept for the session
  }

  get repo() { return this.app.repo; }

  #model() {
    const { transactions: all, settings } = this.repo;
    const month = this.app.month;
    return {
      month, settings,
      summary: monthSummary(all, settings, month),
      avg: averages(all, settings, month),
      projection: projectMonth(all, settings, month, this.overrides),
      plan: parentsPlan(all, settings),
      pending: pendingRecurring(all, settings, month),
      top: topExpenses(monthSummary(all, settings, month).txs),
    };
  }

  render(root) {
    const model = this.#model();
    render(root, dashboardView(model));

    const donut = $('#donut', root);
    if (donut) nestedDonut(donut, donutData(model.summary.spend));
    const planCanvas = $('#plan-chart', root);
    if (planCanvas) planChart(planCanvas, model.plan, { tickLabel: (m) => (m ? shortMonthLabel(m) : '') });

    this.#bind(root);
  }

  #bind(root) {
    on(root, 'input', 'input[type=range]', (e, input) => {
      this.overrides[input.name] = Number(input.value);
      const p = projectMonth(this.repo.transactions, this.repo.settings, this.app.month, this.overrides);
      const body = $('#projection-body', root);
      // Re-render only the projection, then put focus back on the slider being dragged.
      render(body, projectionBody(p));
      $(`input[name=${input.name}]`, body)?.focus();
      // Keep the KPI tile in sync with the what-if.
      const kpiValue = $('[data-kpi=surplus] .tile-value', root);
      if (kpiValue) kpiValue.textContent = signedMoney(p.endSurplus);
    });

    on(root, 'click', '[data-action]', (e, btn) => {
      const { action } = btn.dataset;
      if (action === 'reset-projection') { this.overrides = {}; this.app.refresh(); }
      if (action === 'confirm' || action === 'confirm-all') {
        const pending = pendingRecurring(this.repo.transactions, this.repo.settings, this.app.month);
        const items = action === 'confirm' ? pending.filter((r) => r.id === btn.dataset.id) : pending;
        for (const r of items) this.repo.add(transactionFromRecurring(r, this.app.month));
        toast(items.length === 1 ? `Added “${items[0].description}”` : `Added ${items.length} recurring entries`);
      }
    });

    on(root, 'click', '[data-edit]', (e, el) => this.app.editTransaction(el.dataset.edit));
  }
}
