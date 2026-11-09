// Small UI pieces shared by the pages.

import { h, fmt } from './dom.js';
import { severityOf } from './levels.js';

/**
 * A KPI tile: a big number and its label.
 * @param {string} label
 * @param {number | string} value  numbers are formatted, strings shown as they are
 * @param {'neutral' | 'primary' | 'success' | 'warning' | 'danger'} [tone]
 */
export function kpi(label, value, tone = 'neutral') {
  return h(
    'div',
    { class: `kpi is-${tone}` },
    h('span', { class: 'kpi-value' }, typeof value === 'number' ? fmt.int(value) : value),
    h('span', { class: 'kpi-label' }, label),
  );
}

/**
 * The coloured alert-level badge.
 * @param {number} level  0–15
 */
export function levelBadge(level) {
  const severity = severityOf(level);
  return h(
    'span',
    { class: `level sev-${severity}`, title: `Level ${level} · ${severity} severity` },
    String(level),
  );
}
