// Statistical anomaly models: train on NORMAL traffic, then score new requests.
// Thresholds are applied by the caller so the ROC can sweep them (standards §3, methods.md).
// Pure, runtime-agnostic.
//
// Conventions (ADR-007): statistics are kept per (path, parameter) pair, and every signal turns
// the tail probability p of the observed value under the normal model into the score
// s = −log10(p), so higher always means more anomalous and signals can be compared and combined.
//
// Implemented: the per-pair model and a BASELINE length signal (Chebyshev bound), so the pipeline
// runs end-to-end. The pedagogically central methods are specified stubs with a backlog id —
// that is the group's work:
//   - chiSquareScore        (C-03)  the headline method (Kruegel & Vigna 2003, ADR-008)
//   - robust outliers       (C-05)  IQR / MAD, and Mahalanobis for the multivariate case
//   - combination           (C-06)  add those signals to scoreRequest

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

/**
 * Largest standardised length deviation z = |x − μ| / σ across the request's parameters, using
 * the statistics of each (path, parameter) pair. Pairs unseen in training, or with σ = 0, are
 * skipped for now; the policy for them is decided in C-04.
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ z: number, param: string | null }} the largest z (≥ 0) and its parameter
 */
export function lengthZScore(model, request) {
  const f = extractFeatures(request);
  let z = 0;
  /** @type {string | null} */
  let param = null;
  for (const p of f.params) {
    const stats = model.params[paramKey(f.path, p.name)];
    if (!stats || stats.length.std === 0) continue;
    const zp = Math.abs(p.length - stats.length.mean) / stats.length.std;
    if (zp > z) {
      z = zp;
      param = p.name;
    }
  }
  return { z, param };
}

/**
 * BASELINE length signal (C-04) on the common scale. Chebyshev's inequality bounds the tail of
 * ANY distribution, P(|X − μ| ≥ zσ) ≤ 1/z², so p = min(1, 1/z²) and s = −log10(p) (ADR-007).
 * Distribution-free (lengths are skewed), and the bound Kruegel & Vigna use for lengths. It bounds
 * a NEW observation — it is not a confidence interval (methods.md §3).
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ score: number, z: number, param: string | null }}
 */
export function lengthScore(model, request) {
  const { z, param } = lengthZScore(model, request);
  return { score: pToScore(1 / (z * z)), z, param };
}

/**
 * HEADLINE METHOD — chi-square score on the character distribution (methods.md §4, ADR-008).
 * For each parameter value with N characters: observed class counts O_i against expected
 * E_i = N · p̂_i, with Laplace-smoothed p̂_i = (c_i + 1) / (C + k) from the pair's training counts
 * (the pooled counts if the pair is unseen), so E_i > 0 always. χ² = Σ (O_i − E_i)² / E_i with
 * df = k − 1 = 6; no class merging, no Yates correction. The p-value from the χ²(6) survival
 * function is NOMINAL (the E_i are small), so it is used only as a score, s = −log10(p), computed
 * in log space so it cannot underflow. Report the most anomalous parameter.
 *
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ chiSquare: number, df: number, pValue: number, score: number, param: string | null }}
 */
// eslint-disable-next-line no-unused-vars
export function chiSquareScore(model, request) {
  // TODO(C-03): implement the smoothed chi-square score (ADR-008, methods.md §4).
  throw new Error('chiSquareScore not implemented yet (backlog C-03)');
}

/**
 * Combine the statistical signals into one anomaly score (ADR-007): every part is on the
 * −log10(p) scale and the score is their maximum; `top` names the part that produced it.
 * Higher = more anomalous. The caller applies the threshold.
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ score: number, parts: Record<string, number>, top: string | null }}
 */
export function scoreRequest(model, request) {
  /** @type {Record<string, number>} */
  const parts = { length: lengthScore(model, request).score };
  // TODO(C-06): add parts.chiSquare (C-03) and the outlier parts (C-05), each as −log10(p).
  let score = 0;
  /** @type {string | null} */
  let top = null;
  for (const [name, s] of Object.entries(parts)) {
    if (s > score) {
      score = s;
      top = name;
    }
  }
  return { score, parts, top };
}
