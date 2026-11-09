// Overview: key figures, alerts by severity and by level, what raised them, the most frequent
// signatures, and links to the other modules.

import { initShell } from '../shell.js';
import { runExperiment, countBy } from '../pipeline.js';
import { SEVERITIES, SIGNATURE_LEVEL, severityOf } from '../levels.js';
import { h, mount, fmt } from '../dom.js';
import { kpi } from '../ui.js';
import { setupCharts, barChart, doughnutChart, token } from '../charts.js';

const state = initShell();
const { events } = runExperiment(state);
const alerts = events.filter((e) => e.alert);

mount(
  '#kpis',
  kpi('Requests analysed', events.length),
  kpi('Alerts', alerts.length, 'primary'),
  kpi('Signature matches', alerts.filter((e) => e.result.ruleMatched).length, 'danger'),
  kpi(
    'Statistical alerts (no rule matched)',
    alerts.filter((e) => !e.result.ruleMatched).length,
    'warning',
  ),
);

const SEVERITY_TEXT = {
  critical: ['Critical', 'level 15 · a signature matched'],
  high: ['High', 'level 4–14 · p ≤ 10⁻⁴'],
  medium: ['Medium', 'level 2–3 · p ≤ 10⁻²'],
  low: ['Low', 'level 0–1'],
};
const bySeverity = countBy(alerts, (e) => severityOf(e.level));
mount(
  '#severity',
  [...SEVERITIES].reverse().map((severity) => {
    const [name, info] = SEVERITY_TEXT[severity];
    return h(
      'div',
      { class: `sev-tile sev-${severity}` },
      h('span', { class: 'sev-count' }, fmt.int(bySeverity.get(severity) ?? 0)),
      h('span', { class: 'sev-name' }, `${name} severity`),
      h('span', { class: 'sev-info' }, info),
    );
  }),
);

setupCharts();

const levels = Array.from({ length: SIGNATURE_LEVEL + 1 }, (_, level) => level);
const byLevel = countBy(alerts, (e) => e.level);
barChart(canvas('#chart-levels'), {
  label: 'Alerts',
  labels: levels.map(String),
  values: levels.map((level) => byLevel.get(level) ?? 0),
  colors: levels.map((level) => token(`--sev-${severityOf(level)}`)),
});

const bySource = countBy(alerts, (e) => e.source);
if (alerts.length) {
  doughnutChart(canvas('#chart-source'), {
    labels: ['Signature only', 'Statistics only', 'Both'],
    values: ['signature', 'statistics', 'both'].map((s) => bySource.get(s) ?? 0),
    colors: [token('--src-signature'), token('--src-statistics'), token('--src-both')],
  });
} else {
  empty('#chart-source', 'No alerts with these settings.');
}

const hitsByRule = new Map();
for (const e of events) {
  for (const id of new Set(e.result.detail.hits.map((hit) => hit.ruleId))) {
    hitsByRule.set(id, (hitsByRule.get(id) ?? 0) + 1);
  }
}
const topRules = [...hitsByRule]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 7);
if (topRules.length) {
  barChart(canvas('#chart-rules'), {
    label: 'Requests matched',
    labels: topRules.map(([id]) => id),
    values: topRules.map(([, n]) => n),
    colors: token('--primary'),
    horizontal: true,
  });
} else {
  empty(
    '#chart-rules',
    state.mode === 'stats'
      ? 'Rules are not evaluated in statistics-only mode.'
      : 'No signature matched.',
  );
}

/** @param {string} selector */
function canvas(selector) {
  return /** @type {HTMLCanvasElement} */ (document.querySelector(selector));
}

/** Replace a chart's box with a message. @param {string} selector @param {string} text */
function empty(selector, text) {
  const box = canvas(selector).parentElement;
  box?.replaceWith(h('p', { class: 'empty-chart' }, text));
}
