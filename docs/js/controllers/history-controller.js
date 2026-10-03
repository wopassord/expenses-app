import { render, $ } from '../lib/dom.js';
import { MACROS, MACRO_ORDER, macroColor } from '../models/catalog.js';
import { currentMonth, monthOf, monthRange, shortMonthLabel } from '../lib/dates.js';
import { monthSummary, averages, completedMonths } from '../services/stats.js';
import { historyView } from '../views/history-view.js';
import { stackedMonths } from '../views/charts.js';

export class HistoryController {
  constructor(app) { this.app = app; }

  render(root) {
    const { transactions: all, settings } = this.app.repo;
    const now = currentMonth();
    const months = all.length ? monthRange(monthOf(all[all.length - 1].date), now) : [];
    const summaries = months.map((m) => monthSummary(all, settings, m));
    const avg = averages(all, settings, now);
    const full = new Set(completedMonths(all, settings, now));
    const partial = new Set(months.filter((m) => m !== now && !full.has(m)));
    const macrosUsed = MACRO_ORDER.filter((m) => summaries.some((s) => s.spend.byMacro[m] > 0));

    render(root, historyView({ months, summaries, avg, partial, macrosUsed }));

    const canvas = $('#history-chart', root);
    if (canvas) {
      stackedMonths(canvas, {
        labels: months.map((m) => shortMonthLabel(m) + (partial.has(m) ? '*' : '')),
        series: macrosUsed.map((m) => ({
          label: MACROS[m].label,
          color: macroColor(m),
          data: summaries.map((s) => Math.max(0, s.spend.byMacro[m] ?? 0)),
        })),
        average: avg?.total,
      });
    }
  }
}
