// The experiment behind every page (ADR-003, ADR-010): build the seeded dataset, fit the
// statistical model on legitimate traffic only (ADR-004), set the threshold on the legitimate
// calibration split at the target false-positive rate (ADR-009, E-06), run the detector over the
// held-out test split and summarise. Pure: no DOM, tested in Node; the pages only render what it
// returns.

import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { confusionMatrix, metrics, thresholdAtFpr } from '@anomaly-guard/evaluation';
import { levelOf } from './levels.js';

/** Training split size: fixed, so the URL carries few settings. */
export const TRAIN_SIZE = 800;

/** Legitimate requests the threshold is calibrated on: enough for targets down to 0.5% (state.js). */
export const CALIBRATION_SIZE = 2000;

/** Share of the legitimate test requests that are hard cases (A-05), so false positives show up. */
export const HARD_SHARE = 0.05;

/**
 * @typedef {Object} DashboardEvent
 * @property {number} id          1-based position in the test split
 * @property {any} sample         `{ request, label, kind, variant }` from the dataset
 * @property {ReturnType<typeof detect>} result
 * @property {number} level       alert level 0–15 (src/levels.js)
 * @property {boolean} alert      the detector flagged it
 * @property {boolean} attack     ground truth from the simulator (never seen by the detector)
 * @property {boolean} correct    alert === attack
 * @property {'signature' | 'statistics' | 'both' | 'none'} source  what raised the alert
 */

/**
 * @typedef {Object} OperatingPoint  the threshold the detector uses, and where it comes from
 * @property {'calibrated' | 'manual' | 'rules'} source  'rules': rules mode has no threshold
 * @property {number} threshold        what `detect` gets (ignored in rules mode)
 * @property {number | null} target    target false-positive rate, null with a manual threshold
 * @property {number} calibrationFpr   share of the legitimate calibration requests it flags
 * @property {boolean | null} attainable  false when the target cannot be met (thresholdAtFpr)
 * @property {number} calibrationSize
 */

/**
 * @param {import('./state.js').ExperimentState} state
 */
export function runExperiment(state) {
  const { seed, mode, prevalence, size } = state;
  const dataset = buildDataset({
    seed,
    trainSize: TRAIN_SIZE,
    calibrationSize: CALIBRATION_SIZE,
    testSize: size,
    prevalence,
    hardShare: HARD_SHARE,
  });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(dataset.train.map((s) => s.request)); // legitimate only (ADR-004)
  const operating = operatingPoint(state, dataset.calibration, { ruleEngine, model });
  const { threshold } = operating;

  /** @type {DashboardEvent[]} */
  const events = dataset.test.map((sample, i) => {
    const result = detect(sample.request, { ruleEngine, model, threshold, mode });
    const alert = result.verdict === 'attack';
    const attack = sample.label === 'attack';
    return {
      id: i + 1,
      sample,
      result,
      level: levelOf(result),
      alert,
      attack,
      correct: alert === attack,
      source: sourceOf(result, alert, threshold, mode),
    };
  });

  const cm = confusionMatrix(
    events.map((e) => e.alert),
    events.map((e) => e.attack),
  );
  return { state, dataset, model, ruleEngine, operating, events, cm, metrics: metrics(cm) };
}

/**
 * The operating point of the detector, from the LEGITIMATE calibration split only (ADR-009): the
 * threshold for the target false-positive rate, or the manual threshold with the share of
 * calibration requests it would flag. Rules mode has no threshold; its calibration FPR is the
 * share of legitimate requests that match a rule.
 * @param {import('./state.js').ExperimentState} state
 * @param {{ request: any }[]} calibration  legitimate requests, never the test split
 * @param {{ ruleEngine: RuleEngine, model: any }} detector
 * @returns {OperatingPoint}
 */
export function operatingPoint(state, calibration, { ruleEngine, model }) {
  const { mode, fpr } = state;
  const target = fpr === 'manual' ? null : fpr;
  // Only the score matters here: the threshold given to detect only sets its verdict.
  const scores = calibration.map(
    (s) => detect(s.request, { ruleEngine, model, mode, threshold: 0 }).score,
  );
  const n = scores.length;
  const flagged = (cut) => scores.filter((score) => score >= cut).length;
  if (mode === 'rules') {
    // No threshold: rules mode scores 1 on a rule match, else 0. Do the rules alone stay within
    // the target on legitimate traffic?
    const matched = flagged(1);
    return {
      source: 'rules',
      threshold: state.threshold, // ignored by detect in rules mode
      target,
      calibrationFpr: matched / n,
      attainable: target === null ? null : matched <= Math.floor(target * n + 1e-9),
      calibrationSize: n,
    };
  }
  if (target === null) {
    return {
      source: 'manual',
      threshold: state.threshold,
      target,
      calibrationFpr: flagged(state.threshold) / n,
      attainable: null,
      calibrationSize: n,
    };
  }
  const calibrated = thresholdAtFpr(scores, target);
  return {
    source: 'calibrated',
    threshold: calibrated.threshold,
    target,
    calibrationFpr: calibrated.calibrationFpr,
    attainable: calibrated.attainable,
    calibrationSize: n,
  };
}

/**
 * What raised an alert: a signature, the statistical score, or both.
 * @param {ReturnType<typeof detect>} result
 * @param {boolean} alert
 * @param {number} threshold
 * @param {import('./state.js').Mode} mode
 * @returns {'signature' | 'statistics' | 'both' | 'none'}
 */
export function sourceOf(result, alert, threshold, mode) {
  if (!alert) return 'none';
  const byStats = mode !== 'rules' && result.statScore >= threshold;
  if (result.ruleMatched && byStats) return 'both';
  return result.ruleMatched ? 'signature' : 'statistics';
}

/**
 * The statistical signal with the highest score.
 * @param {Record<string, number>} parts  `detect().detail.parts`
 * @returns {{ name: string, score: number } | null}
 */
export function topPart(parts) {
  let best = null;
  for (const [name, score] of Object.entries(parts)) {
    if (best === null || score > best.score) best = { name, score };
  }
  return best;
}

/**
 * Count items by key.
 * @template T, K
 * @param {T[]} items
 * @param {(item: T) => K} key
 * @returns {Map<K, number>}
 */
export function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}
