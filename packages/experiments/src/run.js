// The D-04 experiment (ADR-009). For every seed: build a fresh dataset, fit the statistical model
// on its legitimate training split (ADR-004), set one threshold per mode and target FPR on its
// legitimate calibration split (D-06), then score its test split once and measure the result
// with intervals (D-03, D-05). Finally summarise across seeds. No file system here: cli.js writes
// the files, so this part can be tested on its own.

import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset, createRng } from '@anomaly-guard/traffic';
import {
  evaluateAt,
  thresholdAtFpr,
  wilsonInterval,
  bootstrapAucInterval,
  meanInterval,
} from '@anomaly-guard/evaluation';

export const MODES = ['rules', 'stats', 'combined'];

/**
 * @typedef {Object} ExperimentConfig
 * @property {number[]} seeds          dataset seeds, one run each (ADR-009: at least 20)
 * @property {number} trainSize        legitimate requests the model is fitted on
 * @property {number} calibrationSize  legitimate requests the thresholds are set on (≥ 10/α)
 * @property {number} testSize         requests scored once per seed
 * @property {number} prevalence       attack share of the test split
 * @property {number} hardShare        share of the legitimate test requests that are hard cases
 * @property {number[]} targets        target false-positive rates α
 * @property {number} resamples        bootstrap resamples for the AUC interval
 */

/**
 * The configuration ADR-009 asks for: 20 seeds; 10,000 calibration requests, so that even the
 * 0.1% target rests on 10 scores (n ≥ 10/α, methods.md §6).
 * @type {Readonly<ExperimentConfig>}
 */
export const DEFAULT_CONFIG = Object.freeze({
  seeds: Object.freeze(Array.from({ length: 20 }, (_, i) => i + 1)),
  trainSize: 2000,
  calibrationSize: 10000,
  testSize: 5000,
  prevalence: 0.1,
  hardShare: 0.05,
  targets: Object.freeze([0.01, 0.001]),
  resamples: 1000,
});

const RATE = { range: /** @type {[number, number]} */ ([0, 1]) };

/**
 * Run the experiment on every seed and summarise across them.
 * @param {Partial<ExperimentConfig>} [options]  missing fields take DEFAULT_CONFIG
 * @param {{ onSeed?: (done: number, total: number, seed: number) => void }} [hooks]  progress
 */
export function runExperiment(options = {}, { onSeed } = {}) {
  const config = validateConfig({ ...DEFAULT_CONFIG, ...options });
  const seeds = config.seeds.map((seed, i) => {
    const result = runSeed(seed, config);
    onSeed?.(i + 1, config.seeds.length, seed);
    return result;
  });
  return { config, summary: summarise(seeds, config), seeds };
}

/**
 * One run: dataset, model, thresholds and test results for one seed.
 * @param {number} seed
 * @param {ExperimentConfig} config  already validated
 */
export function runSeed(seed, config) {
  const { trainSize, calibrationSize, testSize, prevalence, hardShare, targets, resamples } =
    config;
  const { train, calibration, test } = buildDataset({
    seed,
    trainSize,
    calibrationSize,
    testSize,
    prevalence,
    hardShare,
  });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(train.map((s) => s.request)); // legitimate only (ADR-004)
  const bootstrapSeed = bootstrapSeedFor(seed);

  /** @type {Record<string, { auc: ReturnType<typeof bootstrapAucInterval>, points: ReturnType<typeof operatingPoint>[] }>} */
  const modes = {};
  for (const mode of MODES) {
    // Only the score is used: it is compared with the calibrated threshold below, so the
    // threshold passed to detect (which only sets its verdict) does not matter.
    const scoreOf = (sample) =>
      detect(sample.request, { ruleEngine, model, mode, threshold: 0 }).score;
    const calibrationScores = calibration.map(scoreOf); // legitimate only: no label is needed
    const scored = test.map((s) => ({
      label: s.label,
      kind: s.kind,
      variant: s.variant,
      score: scoreOf(s),
    }));
    modes[mode] = {
      // Every mode gets the same resamples (same seed, same order): a paired bootstrap.
      auc: bootstrapAucInterval(scored, { random: createRng(bootstrapSeed).next, resamples }),
      points: targets.map((target) =>
        operatingPoint(scored, calibrate(mode, calibrationScores, target), target),
      ),
    };
  }
  return { seed, bootstrapSeed, modes };
}

/**
 * The bootstrap's own seed: seed + 2³¹ (mod 2³²). The generator (mulberry32) steps through one
 * cycle of 2³² states, so this starts the bootstrap's random stream half a cycle away from the
 * dataset's stream of the same seed: the two never share random numbers.
 * @param {number} seed
 */
export function bootstrapSeedFor(seed) {
  return (seed + 0x80000000) >>> 0;
}

/**
 * The operating point of a mode at a target FPR, from legitimate calibration scores only.
 * @param {string} mode
 * @param {number[]} scores  calibration scores
 * @param {number} target
 */
function calibrate(mode, scores, target) {
  if (mode !== 'rules') return { ...thresholdAtFpr(scores, target), calibrated: true };
  // Rules mode scores 1 on a rule match, else 0: its only operating point is "flag on a match".
  // Nothing to calibrate, but report how often it fires on legitimate calibration traffic.
  const flagged = scores.filter((s) => s >= 1).length;
  return {
    threshold: 1,
    calibrationFpr: flagged / scores.length,
    attainable: flagged <= Math.floor(target * scores.length + 1e-9),
    n: scores.length,
    calibrated: false,
  };
}

/**
 * Test-set results at one threshold, with 95% Wilson intervals (D-05).
 * @param {{ label: 'attack'|'legit', kind: string, variant: string, score: number }[]} scored
 * @param {{ threshold: number, calibrationFpr: number, attainable: boolean, calibrated: boolean }} calibration
 * @param {number} target
 */
function operatingPoint(scored, { threshold, calibrationFpr, attainable, calibrated }, target) {
  const { confusion, f1 } = evaluateAt(scored, threshold);
  const { tp, fp, tn, fn } = confusion;
  return {
    target,
    calibrated,
    threshold,
    calibrationFpr,
    attainable,
    confusion,
    tpr: wilsonInterval(tp, tp + fn),
    fpr: wilsonInterval(fp, fp + tn),
    fnr: wilsonInterval(fn, tp + fn),
    precision: tp + fp > 0 ? wilsonInterval(tp, tp + fp) : null, // undefined without alarms
    f1,
    byVariant: breakdown(scored, threshold, 'variant'),
    byKind: breakdown(scored, threshold, 'kind'),
  };
}

/**
 * Share of each group flagged at the threshold, split by label: for attacks it is the detection
 * rate of that variant or family, for legitimate requests its false-positive rate.
 * @param {{ label: 'attack'|'legit', score: number }[]} scored
 * @param {number} threshold
 * @param {'variant' | 'kind'} field
 */
function breakdown(scored, threshold, field) {
  /** @type {Record<'attack'|'legit', Record<string, { requests: number, flagged: number }>>} */
  const counts = { attack: {}, legit: {} };
  for (const s of scored) {
    const group = (counts[s.label][s[field]] ??= { requests: 0, flagged: 0 });
    group.requests++;
    if (s.score >= threshold) group.flagged++;
  }
  const withRates = (groups) =>
    sortedEntries(groups).map(([name, g]) => [
      name,
      { ...g, rate: wilsonInterval(g.flagged, g.requests) },
    ]);
  return {
    attack: Object.fromEntries(withRates(counts.attack)),
    legit: Object.fromEntries(withRates(counts.legit)),
  };
}

/**
 * Across seeds: the mean of every per-seed value with its 95% Student-t interval (the seed is the
 * independent unit), the spread, and the confusion matrices added up.
 * @param {ReturnType<typeof runSeed>[]} seedResults
 * @param {ExperimentConfig} config
 */
function summarise(seedResults, config) {
  /** @type {Record<string, any>} */
  const modes = {};
  for (const mode of MODES) {
    const runs = seedResults.map((r) => r.modes[mode]);
    modes[mode] = {
      auc: meanInterval(
        runs.map((r) => r.auc.estimate),
        RATE,
      ),
      aucBootstrapWidth: mean(runs.map((r) => r.auc.upper - r.auc.lower)),
      points: config.targets.map((target, i) =>
        summarisePoint(
          runs.map((r) => r.points[i]),
          target,
        ),
      ),
    };
  }
  return { modes };
}

/** @param {ReturnType<typeof operatingPoint>[]} points  one per seed, same mode and target */
function summarisePoint(points, target) {
  const across = (value, options) => meanInterval(points.map(value), options);
  const precisions = points.filter((p) => p.precision).map((p) => p.precision.estimate);
  const pooled = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const p of points) for (const key of Object.keys(pooled)) pooled[key] += p.confusion[key];
  return {
    target,
    calibrated: points[0].calibrated,
    attainableSeeds: points.filter((p) => p.attainable).length,
    threshold: across((p) => p.threshold),
    calibrationFpr: across((p) => p.calibrationFpr, RATE),
    tpr: across((p) => p.tpr.estimate, RATE),
    fpr: across((p) => p.fpr.estimate, RATE),
    fnr: across((p) => p.fnr.estimate, RATE),
    precision: precisions.length >= 2 ? meanInterval(precisions, RATE) : null,
    precisionSeeds: precisions.length, // seeds with at least one alarm
    f1: across((p) => p.f1, RATE),
    pooled,
    byVariant: summariseGroups(points.map((p) => p.byVariant)),
    byKind: summariseGroups(points.map((p) => p.byKind)),
  };
}

/** Per group: pooled counts, and the mean per-seed rate over the seeds where the group occurs. */
function summariseGroups(perSeed) {
  const result = { attack: {}, legit: {} };
  for (const label of /** @type {const} */ (['attack', 'legit'])) {
    const names = [...new Set(perSeed.flatMap((groups) => Object.keys(groups[label])))].sort();
    for (const name of names) {
      const present = perSeed.map((groups) => groups[label][name]).filter(Boolean);
      const sizes = present.map((g) => g.requests);
      const rates = present.map((g) => g.flagged / g.requests);
      result[label][name] = {
        requests: sizes.reduce((sum, n) => sum + n, 0),
        flagged: present.reduce((sum, g) => sum + g.flagged, 0),
        seeds: present.length,
        requestsPerSeed: { min: Math.min(...sizes), max: Math.max(...sizes) },
        rate: rates.length >= 2 ? meanInterval(rates, RATE) : null,
      };
    }
  }
  return result;
}

/**
 * Check a configuration and return a plain copy of it.
 * @param {ExperimentConfig} config
 * @returns {ExperimentConfig}
 */
export function validateConfig(config) {
  const { seeds, trainSize, calibrationSize, testSize, prevalence, hardShare, targets, resamples } =
    config;
  const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
  const isSeed = (s) => Number.isInteger(s) && s >= 0 && s <= 0xffffffff;
  if (!Array.isArray(seeds) || seeds.length < 2 || !seeds.every(isSeed)) {
    throw new RangeError('seeds: at least two unsigned 32-bit integers');
  }
  if (new Set(seeds).size !== seeds.length) throw new RangeError('seeds: must be distinct');
  for (const [name, value, min] of [
    ['trainSize', trainSize, 1],
    ['calibrationSize', calibrationSize, 1],
    ['testSize', testSize, 2],
    ['resamples', resamples, 1],
  ]) {
    if (!Number.isSafeInteger(value) || value < min) {
      throw new RangeError(`${name}: an integer ≥ ${min}`);
    }
  }
  const attacks = Math.round(testSize * prevalence);
  if (!isNumber(prevalence) || attacks < 1 || attacks > testSize - 1) {
    throw new RangeError('prevalence: the test split needs at least one attack and one legit');
  }
  if (!isNumber(hardShare) || hardShare < 0 || hardShare > 1) {
    throw new RangeError('hardShare: a number in [0, 1]');
  }
  if (
    !Array.isArray(targets) ||
    targets.length === 0 ||
    !targets.every((t) => isNumber(t) && t >= 0 && t < 1) ||
    new Set(targets).size !== targets.length
  ) {
    throw new RangeError('targets: distinct false-positive rates in [0, 1)');
  }
  return {
    seeds: [...seeds],
    trainSize,
    calibrationSize,
    testSize,
    prevalence,
    hardShare,
    targets: [...targets],
    resamples,
  };
}

/** @param {number[]} values */
function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Entries sorted by key, so that the output does not depend on the order of the requests. */
function sortedEntries(object) {
  return Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
