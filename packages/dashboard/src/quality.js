// Detection quality of one run, for evaluation.html (E-06, and the ROC of E-02 — theme T3): the
// error rates with their 95% Wilson intervals, the results by variant, and the ROC curve of every
// mode on the same test requests. Pure: no DOM, tested in Node; the page only renders it.

import { detect } from '@anomaly-guard/core';
import { createRng } from '@anomaly-guard/traffic';
import { rocCurve, wilsonInterval, bootstrapAucInterval } from '@anomaly-guard/evaluation';

/** The modes on the ROC chart, in legend order. */
export const ROC_MODES = Object.freeze(['rules', 'stats', 'combined']);

/** Bootstrap resamples for the AUC interval here, kept small for the browser (D-04 uses 1,000). */
export const BROWSER_RESAMPLES = 200;

const VARIANTS = [
  ['attack', 'canonical'],
  ['attack', 'obfuscated'],
  ['attack', 'novel'],
  ['legit', 'typical'],
  ['legit', 'hard'],
];

/**
 * @typedef {{ estimate: number, lower: number, upper: number, n: number }} Interval
 */

/**
 * The error rates of a confusion matrix with their 95% Wilson intervals (D-05); null when a rate
 * is undefined (no attack, no legitimate request, or no alarm).
 * @param {{ tp: number, fp: number, tn: number, fn: number }} cm
 * @returns {{ tpr: Interval | null, fpr: Interval | null, fnr: Interval | null,
 *   precision: Interval | null }}
 */
export function ratesWithIntervals({ tp, fp, tn, fn }) {
  const rate = (x, n) => (n > 0 ? wilsonInterval(x, n) : null);
  return {
    tpr: rate(tp, tp + fn),
    fpr: rate(fp, fp + tn),
    fnr: rate(fn, tp + fn),
    precision: rate(tp, tp + fp),
  };
}

/**
 * The share of each variant that raised an alert: the detection rate for attacks (canonical,
 * obfuscated, novel) and the false-positive rate for legitimate requests (typical, hard).
 * Variants with no request in the test split are left out.
 * @param {import('./pipeline.js').DashboardEvent[]} events
 * @returns {{ label: 'attack' | 'legit', variant: string, requests: number, flagged: number,
 *   rate: Interval }[]}
 */
export function byVariant(events) {
  const rows = [];
  for (const [label, variant] of VARIANTS) {
    const group = events.filter((e) => e.sample.label === label && e.sample.variant === variant);
    if (group.length === 0) continue;
    const flagged = group.filter((e) => e.alert).length;
    rows.push({
      label,
      variant,
      requests: group.length,
      flagged,
      rate: wilsonInterval(flagged, group.length),
    });
  }
  return /** @type {any} */ (rows);
}

/**
 * The ROC curve of every mode on the test split of a run: the same requests and the same model,
 * so the curves compare the modes and nothing else (D-03).
 * @param {Pick<ReturnType<typeof import('./pipeline.js').runExperiment>, 'dataset' | 'ruleEngine' | 'model'>} run
 * @returns {{ mode: string, scored: { label: 'attack'|'legit', score: number }[],
 *   points: { fpr: number, tpr: number, threshold: number }[], auc: number }[] | null}
 *   null when the test split lacks attacks or legitimate requests (no curve without both)
 */
export function rocByMode({ dataset, ruleEngine, model }) {
  const { test } = dataset;
  if (!test.some((s) => s.label === 'attack') || !test.some((s) => s.label === 'legit')) {
    return null;
  }
  return ROC_MODES.map((mode) => {
    // Only the score is used: the curve sweeps every threshold.
    const scored = test.map((s) => ({
      label: s.label,
      score: detect(s.request, { ruleEngine, model, mode, threshold: 0 }).score,
    }));
    return { mode, scored, ...rocCurve(scored) };
  });
}

/**
 * Seeded, stratified bootstrap interval for the AUC of one curve (D-05). The random stream is the
 * one the experiments use for this seed (seed + 2³¹, methods.md §6), never Math.random.
 * @param {{ label: 'attack'|'legit', score: number }[]} scored
 * @param {number} seed  the dataset seed
 * @param {number} [resamples]
 */
export function aucInterval(scored, seed, resamples = BROWSER_RESAMPLES) {
  const random = createRng((seed + 0x80000000) >>> 0).next;
  return bootstrapAucInterval(scored, { random, resamples });
}
