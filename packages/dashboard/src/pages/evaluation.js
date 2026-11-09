// Detection quality: confusion counts and error rates at the current settings. The ROC curve,
// the calibrated threshold, the confusion-matrix view and the per-variant table are theme panels
// (E-02, E-06 — theme T3).

import { initShell } from '../shell.js';
import { runExperiment } from '../pipeline.js';
import { mount, fmt } from '../dom.js';
import { kpi } from '../ui.js';

const state = initShell();
const { cm, metrics: m } = runExperiment(state);

mount(
  '#counts',
  kpi('Attacks caught (true positives)', cm.tp, 'success'),
  kpi('Attacks missed (false negatives)', cm.fn, 'danger'),
  kpi('False alarms (false positives)', cm.fp, 'warning'),
  kpi('Legitimate passed (true negatives)', cm.tn),
);

mount(
  '#rates',
  kpi('Recall (true-positive rate)', fmt.pct(m.recall), 'primary'),
  kpi('False-positive rate', fmt.pct(m.fpr), 'warning'),
  kpi('False-negative rate', fmt.pct(m.fnr), 'danger'),
  kpi('Precision', fmt.pct(m.precision)),
  kpi('F1', m.f1.toFixed(3)),
);
