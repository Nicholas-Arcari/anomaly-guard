import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { rocCurve, thresholdAtFpr, meanInterval } from '@anomaly-guard/evaluation';
import {
  runExperiment,
  runSeed,
  validateConfig,
  bootstrapSeedFor,
  DEFAULT_CONFIG,
  MODES,
} from '../src/run.js';

// Small sizes so the tests stay fast; the real configuration is DEFAULT_CONFIG.
const SMALL = validateConfig({
  seeds: [11, 12, 13],
  trainSize: 300,
  calibrationSize: 1000,
  testSize: 600,
  prevalence: 0.1,
  hardShare: 0.05,
  targets: [0.01, 0.002],
  resamples: 40,
});
const experiment = runExperiment(SMALL);

/** The scores of one seed, recomputed here from scratch. */
function rescore(seed, config, mode) {
  const { train, calibration, test } = buildDataset({ seed, ...sizes(config) });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(train.map((s) => s.request));
  const score = (s) => detect(s.request, { ruleEngine, model, mode, threshold: 0 }).score;
  return {
    calibration: calibration.map(score),
    test: test.map((s) => ({ label: s.label, score: score(s) })),
  };
}

function sizes({ trainSize, calibrationSize, testSize, prevalence, hardShare }) {
  return { trainSize, calibrationSize, testSize, prevalence, hardShare };
}

test('runSeed: each threshold comes from the legitimate calibration split at the target FPR', () => {
  const seed = SMALL.seeds[0];
  const result = experiment.seeds[0];
  for (const mode of ['stats', 'combined']) {
    const { calibration } = rescore(seed, SMALL, mode);
    SMALL.targets.forEach((target, i) => {
      const expected = thresholdAtFpr(calibration, target);
      const point = result.modes[mode].points[i];
      assert.equal(point.threshold, expected.threshold, `${mode} at ${target}`);
      assert.equal(point.calibrationFpr, expected.calibrationFpr);
      assert.equal(point.attainable, expected.attainable);
      assert.equal(point.calibrated, true);
    });
  }
});

test('runSeed: the thresholds do not depend on the test split (no label leaks into them)', () => {
  // buildDataset draws train and calibration first, so another test split leaves them unchanged.
  const other = { ...SMALL, testSize: 900, prevalence: 0.3, hardShare: 0 };
  const a = runSeed(SMALL.seeds[1], SMALL);
  const b = runSeed(SMALL.seeds[1], other);
  for (const mode of MODES) {
    a.modes[mode].points.forEach((point, i) => {
      assert.equal(b.modes[mode].points[i].threshold, point.threshold, mode);
      assert.equal(b.modes[mode].points[i].calibrationFpr, point.calibrationFpr, mode);
    });
  }
  assert.notDeepEqual(b.modes.stats.points[0].confusion, a.modes.stats.points[0].confusion);
});

test('runSeed: the test results agree with the evaluation functions and add up', () => {
  const result = experiment.seeds[2];
  const attacks = Math.round(SMALL.testSize * SMALL.prevalence);
  for (const mode of MODES) {
    const { test: scored } = rescore(SMALL.seeds[2], SMALL, mode);
    assert.equal(result.modes[mode].auc.estimate, rocCurve(scored).auc, mode);
    for (const point of result.modes[mode].points) {
      const { tp, fp, tn, fn } = point.confusion;
      assert.equal(tp + fn, attacks);
      assert.equal(fp + tn, SMALL.testSize - attacks);
      assert.equal(point.tpr.estimate, tp / (tp + fn));
      assert.equal(point.fpr.estimate, fp / (fp + tn));
      for (const field of ['byVariant', 'byKind']) {
        const total = (label, key) =>
          Object.values(point[field][label]).reduce((sum, group) => sum + group[key], 0);
        assert.equal(total('attack', 'requests'), tp + fn, `${mode} ${field}`);
        assert.equal(total('attack', 'flagged'), tp, `${mode} ${field}`);
        assert.equal(total('legit', 'requests'), fp + tn, `${mode} ${field}`);
        assert.equal(total('legit', 'flagged'), fp, `${mode} ${field}`);
      }
    }
  }
});

test('runSeed: rules mode has one fixed operating point, the same at every target', () => {
  const { train, calibration } = buildDataset({ seed: SMALL.seeds[0], ...sizes(SMALL) });
  assert.ok(
    train.every((s) => s.label === 'legit') && calibration.every((s) => s.label === 'legit'),
  );
  const ruleEngine = new RuleEngine();
  const matched = calibration.filter((s) => ruleEngine.inspect(s.request).matched).length;
  const [first, ...others] = experiment.seeds[0].modes.rules.points;
  assert.equal(first.threshold, 1);
  assert.equal(first.calibrated, false);
  assert.equal(first.calibrationFpr, matched / calibration.length);
  for (const point of others) assert.deepEqual(point.confusion, first.confusion);
});

test('runExperiment: reproducible, and the summary is computed from the seeds', () => {
  assert.deepEqual(runExperiment(SMALL), experiment);
  const { seeds, summary } = experiment;
  for (const mode of MODES) {
    const auc = meanInterval(
      seeds.map((r) => r.modes[mode].auc.estimate),
      { range: [0, 1] },
    );
    assert.deepEqual(summary.modes[mode].auc, auc);
    SMALL.targets.forEach((_target, i) => {
      const points = seeds.map((r) => r.modes[mode].points[i]);
      const point = summary.modes[mode].points[i];
      assert.deepEqual(
        point.tpr,
        meanInterval(
          points.map((p) => p.tpr.estimate),
          { range: [0, 1] },
        ),
      );
      assert.equal(point.attainableSeeds, points.filter((p) => p.attainable).length);
      for (const key of ['tp', 'fp', 'tn', 'fn']) {
        assert.equal(
          point.pooled[key],
          points.reduce((sum, p) => sum + p.confusion[key], 0),
        );
      }
      const typical = point.byVariant.legit.typical;
      assert.equal(
        typical.requests,
        points.reduce((sum, p) => sum + p.byVariant.legit.typical.requests, 0),
      );
      assert.equal(typical.seeds, seeds.length);
    });
  }
});

test('bootstrapSeedFor: a different, valid seed for every dataset seed', () => {
  assert.equal(bootstrapSeedFor(1), 0x80000001);
  assert.equal(bootstrapSeedFor(0x80000000), 0);
  assert.equal(bootstrapSeedFor(0xffffffff), 0x7fffffff);
  assert.equal(experiment.seeds[0].bootstrapSeed, bootstrapSeedFor(SMALL.seeds[0]));
});

test('DEFAULT_CONFIG follows ADR-009 and methods.md §6', () => {
  const config = validateConfig(DEFAULT_CONFIG);
  assert.ok(config.seeds.length >= 20);
  for (const target of config.targets) assert.ok(config.calibrationSize >= 10 / target - 1e-9);
  assert.deepEqual(config.targets, [0.01, 0.001]);
});

test('validateConfig: rejects configurations that cannot be run', () => {
  const bad = [
    { seeds: [1] },
    { seeds: [1, 1] },
    { seeds: [1, -2] },
    { seeds: [1, 2.5] },
    { trainSize: 0 },
    { calibrationSize: 1.5 },
    { testSize: 1 },
    { prevalence: 0 },
    { prevalence: 1 },
    { prevalence: '0.1' },
    { testSize: 10, prevalence: 0.01 }, // rounds to no attack at all
    { hardShare: 2 },
    { targets: [] },
    { targets: [1] },
    { targets: [0.01, 0.01] },
    { targets: ['0.01'] },
    { resamples: 0 },
  ];
  for (const change of bad) {
    assert.throws(
      () => validateConfig({ ...DEFAULT_CONFIG, ...change }),
      RangeError,
      JSON.stringify(change),
    );
  }
});
