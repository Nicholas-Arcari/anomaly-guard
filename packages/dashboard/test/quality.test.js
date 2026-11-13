import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rocCurve, wilsonInterval } from '@anomaly-guard/evaluation';
import { runExperiment } from '../src/pipeline.js';
import { DEFAULTS } from '../src/state.js';
import {
  ratesWithIntervals,
  byVariant,
  rocByMode,
  aucInterval,
  ROC_MODES,
  BROWSER_RESAMPLES,
} from '../src/quality.js';

const run = runExperiment({ ...DEFAULTS, size: 600 });

test('ratesWithIntervals: Wilson intervals for each rate, null when undefined', () => {
  const rates = ratesWithIntervals({ tp: 45, fn: 5, fp: 9, tn: 891 });
  assert.deepEqual(rates.tpr, wilsonInterval(45, 50));
  assert.deepEqual(rates.fpr, wilsonInterval(9, 900));
  assert.deepEqual(rates.fnr, wilsonInterval(5, 50));
  assert.deepEqual(rates.precision, wilsonInterval(45, 54));
  const none = ratesWithIntervals({ tp: 0, fn: 0, fp: 0, tn: 10 });
  assert.equal(none.tpr, null);
  assert.equal(none.precision, null);
  assert.equal(none.fpr.estimate, 0);
});

test('byVariant: the groups add up to the confusion matrix', () => {
  const rows = byVariant(run.events);
  const sum = (label, key) =>
    rows.filter((r) => r.label === label).reduce((total, r) => total + r[key], 0);
  assert.equal(sum('attack', 'requests'), run.cm.tp + run.cm.fn);
  assert.equal(sum('attack', 'flagged'), run.cm.tp);
  assert.equal(sum('legit', 'requests'), run.cm.fp + run.cm.tn);
  assert.equal(sum('legit', 'flagged'), run.cm.fp);
  assert.ok(
    rows.some((r) => r.variant === 'hard'),
    'the hard cases are in the test split',
  );
  for (const r of rows) assert.deepEqual(r.rate, wilsonInterval(r.flagged, r.requests));
});

test('rocByMode: one curve per mode on the same test requests, AUC as in rocCurve', () => {
  const curves = rocByMode(run);
  assert.deepEqual(
    curves.map((c) => c.mode),
    ROC_MODES,
  );
  for (const c of curves) {
    assert.equal(c.scored.length, run.dataset.test.length);
    assert.deepEqual(
      c.scored.map((s) => s.label),
      run.dataset.test.map((s) => s.label),
    );
    assert.equal(c.auc, rocCurve(c.scored).auc);
    assert.deepEqual(c.points.at(-1), { ...c.points.at(-1), fpr: 1, tpr: 1 });
  }
  // The current mode's scores are the events' scores: the operating point lies on its curve.
  const current = curves.find((c) => c.mode === run.state.mode);
  assert.deepEqual(
    current.scored.map((s) => s.score),
    run.events.map((e) => e.result.score),
  );
});

test('rocByMode: no curve without both classes', () => {
  assert.equal(rocByMode(runExperiment({ ...DEFAULTS, size: 200, prevalence: 0 })), null);
  assert.equal(rocByMode(runExperiment({ ...DEFAULTS, size: 200, prevalence: 1 })), null);
});

test('aucInterval: seeded and reproducible, and it brackets the AUC', () => {
  const [curve] = rocByMode(run);
  const a = aucInterval(curve.scored, 42, 50);
  assert.deepEqual(a, aucInterval(curve.scored, 42, 50));
  assert.notDeepEqual(a, aucInterval(curve.scored, 43, 50));
  assert.ok(a.lower <= curve.auc && curve.auc <= a.upper);
  assert.equal(aucInterval(curve.scored, 42).resamples, BROWSER_RESAMPLES);
});
