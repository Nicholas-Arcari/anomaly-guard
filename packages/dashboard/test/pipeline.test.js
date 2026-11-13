import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleEngine, detect } from '@anomaly-guard/core';
import { thresholdAtFpr } from '@anomaly-guard/evaluation';
import {
  runExperiment,
  operatingPoint,
  sourceOf,
  topPart,
  countBy,
  TRAIN_SIZE,
  CALIBRATION_SIZE,
} from '../src/pipeline.js';
import { DEFAULTS } from '../src/state.js';

const state = { ...DEFAULTS, size: 300 };

test('runExperiment: same settings, same results (seeded, reproducible)', () => {
  const summary = (run) => run.events.map((e) => [e.id, e.alert, e.level, e.result.score]);
  assert.deepEqual(summary(runExperiment(state)), summary(runExperiment(state)));
});

test('runExperiment: trains on legitimate traffic only and scores the whole test split', () => {
  const run = runExperiment(state);
  assert.ok(run.dataset.train.every((s) => s.label === 'legit'));
  assert.equal(run.model.trainedOn, TRAIN_SIZE);
  assert.equal(run.events.length, state.size);
  const { tp, fp, tn, fn } = run.cm;
  assert.equal(tp + fp + tn + fn, state.size);
  assert.equal(tp + fp, run.events.filter((e) => e.alert).length);
});

test('runExperiment: every alert has a source, every non-alert none; levels stay in 0–15', () => {
  for (const mode of ['combined', 'stats', 'rules']) {
    const run = runExperiment({ ...state, mode });
    for (const e of run.events) {
      assert.equal(e.source === 'none', !e.alert, `${mode} #${e.id}`);
      assert.ok(e.level >= 0 && e.level <= 15);
    }
  }
});

test('runExperiment: the threshold is calibrated on the legitimate calibration split (E-06)', () => {
  for (const mode of ['stats', 'combined']) {
    const run = runExperiment({ ...state, mode, fpr: 0.02 });
    assert.ok(run.dataset.calibration.every((s) => s.label === 'legit'));
    assert.equal(run.dataset.calibration.length, CALIBRATION_SIZE);
    const scores = run.dataset.calibration.map(
      (s) =>
        detect(s.request, { ruleEngine: run.ruleEngine, model: run.model, mode, threshold: 0 })
          .score,
    );
    const expected = thresholdAtFpr(scores, 0.02);
    assert.equal(run.operating.source, 'calibrated');
    assert.equal(run.operating.threshold, expected.threshold, mode);
    assert.equal(run.operating.calibrationFpr, expected.calibrationFpr, mode);
    assert.equal(run.operating.attainable, expected.attainable, mode);
    // The detector used that threshold: an alert exactly when the score reaches it.
    for (const e of run.events) assert.equal(e.alert, e.result.score >= expected.threshold);
  }
});

test('runExperiment: the test split does not move the threshold (no label leaks into it)', () => {
  const a = runExperiment({ ...state, mode: 'stats' });
  const b = runExperiment({ ...state, mode: 'stats', prevalence: 0.4, size: 800 });
  assert.equal(b.operating.threshold, a.operating.threshold);
  assert.notEqual(b.events.length, a.events.length);
});

test('operatingPoint: a manual threshold, and rules mode without a threshold', () => {
  const run = runExperiment({ ...state, mode: 'stats', fpr: 'manual', threshold: 2.5 });
  assert.equal(run.operating.source, 'manual');
  assert.equal(run.operating.threshold, 2.5);
  assert.equal(run.operating.target, null);
  assert.equal(run.operating.attainable, null);
  for (const e of run.events) assert.equal(e.alert, e.result.score >= 2.5);

  const rules = runExperiment({ ...state, mode: 'rules', fpr: 0.05 });
  const engine = new RuleEngine();
  const matched = rules.dataset.calibration.filter((s) => engine.inspect(s.request).matched);
  assert.equal(rules.operating.source, 'rules');
  assert.equal(rules.operating.calibrationFpr, matched.length / CALIBRATION_SIZE);
  assert.equal(rules.operating.attainable, matched.length <= 0.05 * CALIBRATION_SIZE);
  const detector = { ruleEngine: rules.ruleEngine, model: rules.model };
  assert.deepEqual(
    operatingPoint({ ...state, mode: 'rules', fpr: 'manual' }, rules.dataset.calibration, detector)
      .calibrationFpr,
    rules.operating.calibrationFpr,
  );
});

test('sourceOf: signature, statistics or both', () => {
  const r = (ruleMatched, statScore) => ({ ruleMatched, statScore });
  assert.equal(sourceOf(r(true, 0), true, 1, 'combined'), 'signature');
  assert.equal(sourceOf(r(true, 2), true, 1, 'combined'), 'both');
  assert.equal(sourceOf(r(false, 2), true, 1, 'stats'), 'statistics');
  assert.equal(sourceOf(r(true, 2), true, 1, 'rules'), 'signature');
  assert.equal(sourceOf(r(false, 0), false, 1, 'combined'), 'none');
});

test('topPart and countBy', () => {
  assert.deepEqual(topPart({ length: 1.5, chiSquare: 3 }), { name: 'chiSquare', score: 3 });
  assert.equal(topPart({}), null);
  assert.deepEqual(
    [...countBy(['a', 'b', 'a'], (x) => x)],
    [
      ['a', 2],
      ['b', 1],
    ],
  );
});
