// Thin wrappers over Chart.js (vendored, global `Chart`). Each view asks for a
// chart by canvas; charts are destroyed when the view re-renders.
import { money, money0 } from '../lib/format.js';

const live = new Set();

export function destroyCharts() {
  for (const c of live) c.destroy();
  live.clear();
}

function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return {
    surface: v('--surface'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'),
    grid: v('--grid'), axis: v('--axis'), font: v('--font'),
  };
}

function base(t) {
  Chart.defaults.font.family = t.font;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = t.ink3;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.surface, titleColor: t.ink, bodyColor: t.ink2,
        borderColor: t.axis, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
      },
    },
  };
}

function make(canvas, config) {
  const chart = new Chart(canvas, config);
  live.add(chart);
  return chart;
}

/** Two rings: macros inside, categories outside (both share the same 100% = month spend). */
export function nestedDonut(canvas, { inner, outer, total }) {
  const t = tokens();
  return make(canvas, {
    type: 'doughnut',
    data: {
      datasets: [
        { data: outer.map((d) => d.value), backgroundColor: outer.map((d) => d.color), labels: outer.map((d) => d.label),
          borderColor: t.surface, borderWidth: 2, weight: 1.1 },
        { data: inner.map((d) => d.value), backgroundColor: inner.map((d) => d.color), labels: inner.map((d) => d.label),
          borderColor: t.surface, borderWidth: 2, weight: 1 },
      ],
    },
    options: {
      ...base(t),
      cutout: '52%',
      plugins: {
        ...base(t).plugins,
        tooltip: {
          ...base(t).plugins.tooltip,
          callbacks: {
            title: () => '',
            label: (ctx) => {
              const label = ctx.dataset.labels[ctx.dataIndex];
              return ` ${label}: ${money(ctx.parsed)} · ${Math.round((ctx.parsed / total) * 100)}%`;
            },
          },
        },
      },
    },
  });
}

/** Monthly stacked bars by macro, with the average total as a reference line. */
export function stackedMonths(canvas, { labels, series, average }) {
  const t = tokens();
  return make(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        ...series.map((s) => ({
          type: 'bar', label: s.label, data: s.data, backgroundColor: s.color,
          borderColor: t.surface, borderWidth: { top: 2 }, borderSkipped: false, borderRadius: 3,
          maxBarThickness: 44, stack: 'spend',
        })),
        ...(average ? [{
          type: 'line', label: 'Average', data: labels.map(() => average), borderColor: t.ink3,
          borderWidth: 1.5, pointRadius: 0, pointHitRadius: 0, order: -1,
        }] : []),
      ],
    },
    options: {
      ...base(t),
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { color: t.axis } },
        y: { stacked: true, grid: { color: t.grid }, border: { display: false }, ticks: { callback: (v) => money0(v) } },
      },
      plugins: {
        ...base(t).plugins,
        tooltip: {
          ...base(t).plugins.tooltip,
          filter: (item) => item.parsed.y !== 0,
          itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` },
        },
      },
    },
  });
}

/** Savings balance (actual, stepped) vs. the parents' plan line. */
export function planChart(canvas, plan, { tickLabel }) {
  const t = tokens();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return make(canvas, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Plan', data: plan.plan, borderColor: t.ink3, borderWidth: 1.5, pointRadius: 0, tension: 0 },
        { label: 'Savings balance', data: plan.actual, borderColor: accent, backgroundColor: accent,
          borderWidth: 2, stepped: 'before', pointRadius: (ctx) => (ctx.dataIndex === plan.actual.length - 1 ? 4 : 0),
          pointBorderColor: t.surface, pointBorderWidth: 2 },
      ],
    },
    options: {
      ...base(t),
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          type: 'linear', min: 0, max: plan.planDays,
          afterBuildTicks: (axis) => { axis.ticks = plan.ticks.map((k) => ({ value: k.x })); },
          ticks: { callback: (v) => tickLabel(plan.ticks.find((k) => k.x === v)?.month) },
          grid: { color: t.grid }, border: { color: t.axis },
        },
        y: { grid: { color: t.grid }, border: { display: false }, ticks: { callback: (v) => money0(v), maxTicksLimit: 5 } },
      },
      plugins: {
        ...base(t).plugins,
        tooltip: {
          ...base(t).plugins.tooltip,
          callbacks: { title: () => '', label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` },
        },
      },
    },
  });
}
