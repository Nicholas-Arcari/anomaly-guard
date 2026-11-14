// The statistical model, fitted on NORMAL traffic only, and the conventions every signal shares
// (ADR-007): statistics are kept per (path, parameter) pair, and every signal turns the tail
// probability p of the observed value under the normal model into the score s = −log10(p), so
// higher always means more anomalous and signals can be compared and combined. Pure,
// runtime-agnostic.
//
// One file per signal, so the people working on different signals rarely edit the same file:
//   length.js     length bound — Chebyshev BASELINE in place     (C-04)
//   chisquare.js  character distribution — chi-square score       (C-03, C-08)
//   outliers.js   IQR / MAD, Mahalanobis — to be created         (C-05)
//   anomaly.js    scoreRequest: combines the signals             (C-06)

import { extractFeatures } from '../features/extract.js';
import { CHAR_CLASSES } from './entropy.js';

/**
 * Statistics of one (path, parameter) pair, learned from legitimate values only.
 * @typedef {Object} ParamStats
 * @property {number} n  number of training values
 * @property {{ mean: number, std: number }} length  value length: mean and sample std (n − 1)
 * @property {Record<string, number>} classCounts  character-class counts summed over the values
 */

/**
 * @typedef {Object} StatModel
 * @property {Record<string, ParamStats>} params  keyed by paramKey(path, name), e.g. '/search?q'
 * @property {Record<string, number>} classCounts  class counts pooled over every training value
 *   (fallback for sparse or unseen pairs)
 * @property {number} trainedOn  number of (legitimate) requests the model was fitted on
 */

/**
 * Key of a (path, parameter) pair in the model (ADR-007).
 * @param {string} path
 * @param {string} name
 * @returns {string} e.g. '/search?q'
 */
export function paramKey(path, name) {
  return `${path}?${name}`;
}

/**
 * The common anomaly-score scale (ADR-007): s = −log10(p) for a tail probability p.
 * 0 = unremarkable, 1 = p ≤ 0.1, 2 = p ≤ 0.01, 3 = p ≤ 0.001. p is clamped to [MIN_VALUE, 1].
 * @param {number} p
 * @returns {number} s ≥ 0
 */
export function pToScore(p) {
  if (p >= 1) return 0;
  return -Math.log10(Math.max(p, Number.MIN_VALUE));
}

/** @returns {Record<string, number>} a zero count for every class */
function zeroCounts() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const cls of CHAR_CLASSES) counts[cls] = 0;
  return counts;
}

/** @param {number[]} xs @returns {{ mean: number, std: number }} sample std (n − 1; 0 when n < 2) */
function meanStd(xs) {
  const n = xs.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, std: 0 };
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Fit a statistical model on LEGITIMATE traffic only (ADR-004), with one set of statistics per
 * (path, parameter) pair (ADR-007). The model is a plain serialisable object (no closures).
 * @param {import('../features/extract.js').AgRequest[]} normalRequests
 * @returns {StatModel}
 */
export function trainStatModel(normalRequests) {
  /** @type {Record<string, { lengths: number[], classCounts: Record<string, number> }>} */
  const byPair = {};
  const pooled = zeroCounts();

  for (const req of normalRequests) {
    const f = extractFeatures(req);
    for (const p of f.params) {
      const acc = (byPair[paramKey(f.path, p.name)] ??= { lengths: [], classCounts: zeroCounts() });
      acc.lengths.push(p.length);
      for (const cls of CHAR_CLASSES) {
        acc.classCounts[cls] += p.classCounts[cls];
        pooled[cls] += p.classCounts[cls];
      }
    }
  }

  /** @type {Record<string, ParamStats>} */
  const params = {};
  for (const [key, acc] of Object.entries(byPair)) {
    params[key] = {
      n: acc.lengths.length,
      length: meanStd(acc.lengths),
      classCounts: acc.classCounts,
    };
  }
  return { params, classCounts: pooled, trainedOn: normalRequests.length };
}
