// Statistical models: what "normal" looks like per (path, parameter) pair, learned from the
// legitimate training split only (ADR-004, ADR-007), and which signals make up the score.

import { CHAR_CLASSES, scoreRequest } from '@anomaly-guard/core';
import { initShell } from '../shell.js';
import { runExperiment } from '../pipeline.js';
import { h, mount, fmt } from '../dom.js';
import { kpi } from '../ui.js';

/**
 * The planned signals. `part` is the key a signal adds to `scoreRequest().parts` (C-06): a signal
 * shows as "in the score" as soon as that key appears. Set `part` for the outliers when C-05 lands.
 */
const SIGNALS = [
  { part: 'length', name: 'Length', method: 'Chebyshev bound: p ≤ 1/z²', task: 'C-04 · T2' },
  {
    part: 'chiSquare',
    name: 'Character distribution',
    method: 'Chi-square, Laplace-smoothed, df = 6',
    task: 'C-03 · T1',
  },
  { part: null, name: 'Outliers', method: 'IQR / MAD; Mahalanobis distance', task: 'C-05 · T2' },
];

const state = initShell();
const { model, dataset } = runExperiment(state);
const pairs = Object.entries(model.params).sort(([a], [b]) => a.localeCompare(b));
const inScore = new Set(Object.keys(scoreRequest(model, dataset.train[0].request).parts));
const active = SIGNALS.filter((s) => s.part !== null && inScore.has(s.part));

mount(
  '#kpis',
  kpi('Legitimate requests learned', model.trainedOn),
  kpi('Endpoint · parameter pairs', pairs.length),
  kpi('Signals in the score', active.length, 'primary'),
  kpi('Signals still to implement', SIGNALS.length - active.length, 'warning'),
);

mount(
  '#signals-body',
  SIGNALS.map((signal) => {
    const on = signal.part !== null && inScore.has(signal.part);
    return h(
      'tr',
      {},
      h('td', {}, signal.name),
      h('td', {}, signal.method),
      h(
        'td',
        {},
        on
          ? h('span', { class: 'badge is-clean' }, 'In the score')
          : h('span', { class: 'badge is-mistake' }, 'To implement'),
      ),
      h('td', { class: 'mono nowrap' }, signal.task),
    );
  }),
);

mount(
  '#classes-head',
  h('th', {}, 'Endpoint · parameter'),
  h('th', { class: 'num' }, 'Values'),
  h('th', { class: 'num' }, 'Mean length'),
  h('th', { class: 'num' }, 'SD'),
  CHAR_CLASSES.map((cls) => h('th', { class: 'num' }, cls)),
);

mount(
  '#pairs-body',
  pairs.map(([key, stats]) => {
    const total = CHAR_CLASSES.reduce((sum, cls) => sum + stats.classCounts[cls], 0);
    return h(
      'tr',
      {},
      h('td', { class: 'mono nowrap' }, key),
      h('td', { class: 'num' }, fmt.int(stats.n)),
      h('td', { class: 'num' }, stats.length.mean.toFixed(1)),
      h('td', { class: 'num' }, stats.length.std.toFixed(2)),
      CHAR_CLASSES.map((cls) => {
        const count = stats.classCounts[cls];
        return h(
          'td',
          { class: count ? 'num' : 'num muted' },
          count ? fmt.pct(count / total) : '·',
        );
      }),
    );
  }),
);
