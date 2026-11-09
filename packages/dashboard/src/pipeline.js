// The experiment behind every page (ADR-003, ADR-010): build the seeded dataset, fit the
// statistical model on legitimate traffic only (ADR-004), run the detector over the held-out test
// split and summarise. Pure: no DOM, tested in Node; the pages only render what it returns.

import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { confusionMatrix, metrics } from '@anomaly-guard/evaluation';
import { levelOf } from './levels.js';

/** Training split size: fixed, so the URL carries few settings. */
export const TRAIN_SIZE = 800;

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
 * @param {import('./state.js').ExperimentState} state
 */
export function runExperiment(state) {
  const { seed, mode, threshold, prevalence, size } = state;
  const dataset = buildDataset({ seed, trainSize: TRAIN_SIZE, testSize: size, prevalence });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(dataset.train.map((s) => s.request)); // legitimate only (ADR-004)

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
  return { state, dataset, model, ruleEngine, events, cm, metrics: metrics(cm) };
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
