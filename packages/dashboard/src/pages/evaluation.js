// Detection quality (E-06, and the ROC of E-02 — theme T3): the operating point calibrated on
// legitimate requests, the confusion matrix and the error rates with 95% Wilson intervals, the
// results by variant, and the ROC curves of the three modes with their AUC and its bootstrap
// interval.

import { initShell, percent } from '../shell.js';
import { runExperiment } from '../pipeline.js';
import {
  ratesWithIntervals,
  byVariant,
  rocByMode,
  aucInterval,
  pairedComparison,
} from '../quality.js';
import { h, mount, fmt } from '../dom.js';
import { kpi } from '../ui.js';
import { setupCharts, rocChart, token } from '../charts.js';

const MODE_NAMES = {
  rules: 'Rules only',
  stats: 'Statistics only',
  combined: 'Rules + statistics',
};
const MODE_COLORS = { rules: '--src-signature', stats: '--src-statistics', combined: '--src-both' };

const state = initShell();
const run = runExperiment(state);
const { cm, metrics: m, operating } = run;
const rates = ratesWithIntervals(cm);

/** "57.2%" and "[53.0–61.3]" for an interval; "—" when undefined. */
const value = (interval) => (interval ? fmt.pct(interval.estimate) : '—');
const bounds = (interval) =>
  interval
    ? `95% CI ${(interval.lower * 100).toFixed(1)}–${(interval.upper * 100).toFixed(1)}%`
    : 'undefined here';

// ---- operating point -------------------------------------------------------------------------

/** Rates near the target need two decimals: 0.95% is not 1%. */
const pct2 = (x) => `${(x * 100).toFixed(2)}%`;
const calibrationText = `${pct2(operating.calibrationFpr)} of ${fmt.int(operating.calibrationSize)}`;
mount(
  '#operating',
  kpi(
    'Target false-positive rate',
    operating.target === null ? 'manual' : percent(operating.target),
    'primary',
  ),
  kpi(
    'Threshold (−log₁₀ p)',
    operating.source === 'rules' ? '—' : fmt.score(operating.threshold),
    'neutral',
    {
      calibrated: 'set on the calibration split',
      manual: 'set by hand',
      rules: 'rules only: a rule match',
    }[operating.source],
  ),
  kpi(
    'Flagged on the calibration split',
    pct2(operating.calibrationFpr),
    'warning',
    `of ${fmt.int(operating.calibrationSize)} legitimate requests`,
  ),
  kpi(
    'Target met on the calibration split',
    operating.attainable === null ? '—' : operating.attainable ? 'yes' : 'no',
    { true: 'success', false: 'danger' }[String(operating.attainable)] ?? 'neutral',
  ),
);

const notes = [];
if (operating.attainable === false) {
  notes.push(
    h(
      'div',
      { class: 'callout is-warning' },
      operating.source === 'rules'
        ? `The rules alone flag ${pct2(operating.calibrationFpr)} of the legitimate calibration ` +
            `requests, more than the ${percent(operating.target)} target allows, and rules mode ` +
            'has no threshold to move.'
        : `The target cannot be met: the rules alone flag ${pct2(operating.calibrationFpr)} of ` +
            `the legitimate calibration requests, more than ${percent(operating.target)} allows. ` +
            'A rule match scores +∞ and is flagged at any threshold, so the threshold sits above ' +
            'every legitimate statistical score instead: the statistics add no false alarm of ' +
            'their own on the calibration split, and catch fewer attacks.',
    ),
  );
} else if (operating.source === 'manual') {
  notes.push(
    h(
      'div',
      { class: 'callout is-warning' },
      `A threshold set by hand: it flags ${calibrationText} legitimate calibration requests. ` +
        'Choose a calibrated false-positive target in the settings bar to set it on legitimate ' +
        'traffic instead (ADR-009).',
    ),
  );
}
mount('#operating-note', notes);

// ---- confusion matrix and rates ------------------------------------------------------------

const attacks = cm.tp + cm.fn;
const legit = cm.fp + cm.tn;
const rateCell = (name, interval) =>
  h(
    'td',
    { class: 'num' },
    `${name} ${value(interval)}`,
    h('br'),
    h('span', { class: 'muted' }, bounds(interval)),
  );
mount(
  '#matrix',
  h(
    'table',
    { class: 'data' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'col' }, 'Actual'),
        h('th', { scope: 'col', class: 'num' }, 'Alert'),
        h('th', { scope: 'col', class: 'num' }, 'No alert'),
        h('th', { scope: 'col', class: 'num' }, 'Rate'),
      ),
    ),
    h(
      'tbody',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, `Attack (${fmt.int(attacks)})`),
        h('td', { class: 'num' }, `${fmt.int(cm.tp)} caught`),
        h('td', { class: 'num is-bad' }, `${fmt.int(cm.fn)} missed`),
        rateCell('TPR', rates.tpr),
      ),
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, `Legitimate (${fmt.int(legit)})`),
        h('td', { class: 'num is-bad' }, `${fmt.int(cm.fp)} false alarms`),
        h('td', { class: 'num' }, `${fmt.int(cm.tn)} passed`),
        rateCell('FPR', rates.fpr),
      ),
    ),
  ),
);

const alarms = cm.tp + cm.fp;
mount(
  '#matrix-note',
  'Rows are the truth, from the simulator; columns are the detector. TPR = caught / attacks, ' +
    'FPR = false alarms / legitimate requests. ' +
    (alarms === 0
      ? 'No alert at this threshold.'
      : `Of the ${fmt.int(alarms)} alerts, ${fmt.int(cm.tp)} are attacks: precision ` +
        `${value(rates.precision)}.`),
);

mount(
  '#rates',
  kpi('Recall (true-positive rate)', value(rates.tpr), 'primary', bounds(rates.tpr)),
  kpi('False-positive rate', value(rates.fpr), 'warning', bounds(rates.fpr)),
  kpi('False-negative rate', value(rates.fnr), 'danger', bounds(rates.fnr)),
  kpi(
    'Precision (alerts that are attacks)',
    value(rates.precision),
    'neutral',
    bounds(rates.precision),
  ),
  kpi('F1', m.f1.toFixed(3)),
);

// ---- by variant -------------------------------------------------------------------------------

const VARIANT_TEXT = {
  canonical: 'known signatures',
  obfuscated: 'disguised to dodge signatures',
  novel: 'no signature exists',
  typical: 'ordinary traffic',
  hard: 'unusual but legitimate',
};
const rows = byVariant(run.events);
mount(
  '#variants',
  h(
    'table',
    { class: 'data' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'col' }, 'Variant'),
        h('th', { scope: 'col', class: 'num' }, 'Requests'),
        h('th', { scope: 'col', class: 'num' }, 'Alerts'),
        h('th', { scope: 'col', class: 'num' }, 'Share'),
      ),
    ),
    h(
      'tbody',
      {},
      rows.length === 0
        ? h('tr', {}, h('td', { class: 'empty', colspan: '4' }, 'No test requests.'))
        : rows.map((row) =>
            h(
              'tr',
              {},
              h(
                'td',
                {},
                `${row.label === 'attack' ? 'Attack' : 'Legitimate'} · ${row.variant}`,
                h('br'),
                h('span', { class: 'muted' }, VARIANT_TEXT[row.variant] ?? ''),
              ),
              h('td', { class: 'num' }, fmt.int(row.requests)),
              h('td', { class: 'num' }, fmt.int(row.flagged)),
              h(
                'td',
                { class: 'num' },
                value(row.rate),
                h('br'),
                h('span', { class: 'muted' }, bounds(row.rate)),
              ),
            ),
          ),
    ),
  ),
);

// ---- ROC and AUC ------------------------------------------------------------------------------

const curves = rocByMode(run);
if (curves === null) {
  mount(
    '#roc-box',
    h('p', { class: 'empty-chart' }, 'A ROC curve needs both attacks and legitimate requests.'),
  );
  mount('#auc', h('p', { class: 'muted' }, 'Set an attack share between 0 and 1.'));
  mount('#paired', h('p', { class: 'muted' }, 'Needs both attacks and legitimate requests.'));
} else {
  setupCharts();
  const color = (mode) => token(MODE_COLORS[mode]);
  const marks =
    attacks > 0 && legit > 0
      ? [
          {
            label: `Operating point (${MODE_NAMES[state.mode]})`,
            color: color(state.mode),
            fpr: m.fpr,
            tpr: m.recall,
          },
        ]
      : [];
  rocChart(/** @type {HTMLCanvasElement} */ (document.querySelector('#chart-roc')), {
    curves: curves.map((c) => ({
      label: `${MODE_NAMES[c.mode]} (AUC ${c.auc.toFixed(3)})`,
      color: color(c.mode),
      points: c.points,
    })),
    marks,
  });

  // The bootstrap takes a moment in the browser: show the AUC now, fill each interval in its own
  // task so the page stays responsive.
  const intervalCells = curves.map(() => h('td', { class: 'num muted' }, 'computing…'));
  mount(
    '#auc',
    h(
      'table',
      { class: 'data' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, 'Detector'),
          h('th', { scope: 'col', class: 'num' }, 'AUC'),
          h('th', { scope: 'col', class: 'num' }, '95% interval'),
        ),
      ),
      h(
        'tbody',
        {},
        curves.map((c, i) =>
          h(
            'tr',
            {},
            h('td', {}, MODE_NAMES[c.mode]),
            h('td', { class: 'num' }, c.auc.toFixed(3)),
            intervalCells[i],
          ),
        ),
      ),
    ),
  );
  curves.forEach((c, i) => {
    setTimeout(() => {
      const ci = aucInterval(c.scored, state.seed);
      intervalCells[i].textContent = `${ci.lower.toFixed(3)}–${ci.upper.toFixed(3)}`;
      intervalCells[i].className = 'num';
    }, 0);
  });
}

// ---- paired comparison (McNemar, D-07) -------------------------------------------------------

if (curves !== null) {
  /** p-value for the table: bold when below 0.05. */
  const pCell = (test) =>
    h(
      'td',
      { class: 'num' },
      test.exactP < 0.05
        ? h('strong', {}, test.exactP < 0.001 ? '< 0.001' : test.exactP.toFixed(3))
        : test.exactP.toFixed(3),
    );
  const head = (...labels) => labels.map((label) => h('th', { scope: 'col', class: 'num' }, label));
  mount(
    '#paired',
    h(
      'table',
      { class: 'data' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, 'A vs B'),
          head('Attacks caught only by A', 'only by B', 'p'),
          head('False alarms only by A', 'only by B', 'p'),
        ),
      ),
      h(
        'tbody',
        {},
        pairedComparison(run, curves).map(({ modes: [a, b], attack, legit }) =>
          h(
            'tr',
            {},
            h('td', {}, `${MODE_NAMES[a]} vs ${MODE_NAMES[b]}`),
            h('td', { class: 'num' }, fmt.int(attack.onlyA)),
            h('td', { class: 'num' }, fmt.int(attack.onlyB)),
            pCell(attack),
            h('td', { class: 'num' }, fmt.int(legit.onlyA)),
            h('td', { class: 'num' }, fmt.int(legit.onlyB)),
            pCell(legit),
          ),
        ),
      ),
    ),
  );
}
