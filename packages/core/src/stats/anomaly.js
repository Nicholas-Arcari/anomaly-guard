// Statistical anomaly models: train on NORMAL traffic, then score new requests.
// Thresholds are applied by the caller so the ROC can sweep them (standards §3, methods.md).
// Pure, runtime-agnostic.
//
// What is implemented here is a minimal BASELINE (length z-score) so the pipeline runs
// end-to-end and can be tested. The pedagogically central methods are specified stubs with a
// backlog id — that is the group's work:
//   - chiSquareScore        (C-03)  the headline method (Kruegel & Vigna 2003)
//   - robust outliers       (C-05)  IQR / MAD, and Mahalanobis for the multivariate case
//   - richer combination    (C-06)  combine several signals into one score

import { extractFeatures } from '../features/extract.js';
import { CHAR_CLASSES } from './entropy.js';

/**
 * @typedef {Object} StatModel
 * @property {Record<string, {mean:number,std:number,n:number}>} lengthByParam  per-parameter length stats
 * @property {Record<string, number>} expectedClassRatios  expected character-class frequencies (sum≈1)
 * @property {number} trainedOn  number of (legitimate) requests the model was fitted on
 */

/** @param {number[]} xs @returns {{mean:number,std:number,n:number}} population-ish stats (n-1 when n>1) */
function meanStd(xs) {
  const n = xs.length;
  if (n === 0) return { mean: 0, std: 0, n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, std: 0, n };
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance), n };
}

/**
 * Fit a statistical model on LEGITIMATE traffic only (ADR-004). The model is a plain
 * serialisable object (no closures over the training data).
 * @param {import('../features/extract.js').AgRequest[]} normalRequests
 * @returns {StatModel}
 */
export function trainStatModel(normalRequests) {
  /** @type {Record<string, number[]>} */
  const lengthsByParam = {};
  /** @type {Record<string, number>} */
  const classTotals = {};
  for (const cls of CHAR_CLASSES) classTotals[cls] = 0;
  let totalChars = 0;

  for (const req of normalRequests) {
    const f = extractFeatures(req);
    for (const p of f.params) {
      (lengthsByParam[p.name] ??= []).push(p.length);
    }
    for (const cls of CHAR_CLASSES) classTotals[cls] += f.classCounts[cls];
    totalChars += f.totalLength;
  }

  /** @type {Record<string, {mean:number,std:number,n:number}>} */
  const lengthByParam = {};
  for (const [name, xs] of Object.entries(lengthsByParam)) lengthByParam[name] = meanStd(xs);

  /** @type {Record<string, number>} */
  const expectedClassRatios = {};
  for (const cls of CHAR_CLASSES) {
    expectedClassRatios[cls] = totalChars === 0 ? 0 : classTotals[cls] / totalChars;
  }

  return { lengthByParam, expectedClassRatios, trainedOn: normalRequests.length };
}

/**
 * BASELINE signal (C-04): the largest standardised length deviation across the request's
 * parameters, |x − μ| / σ, using the per-parameter stats learned from normal traffic. A new
 * parameter (unseen in training) scores 0 here; decide how to treat unseen params in C-04.
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {number} max z-score (≥ 0)
 */
export function lengthZScore(model, request) {
  const f = extractFeatures(request);
  let max = 0;
  for (const p of f.params) {
    const stats = model.lengthByParam[p.name];
    if (!stats || stats.std === 0) continue;
    const z = Math.abs(p.length - stats.mean) / stats.std;
    if (z > max) max = z;
  }
  return max;
}

/**
 * HEADLINE METHOD — chi-square test on the character distribution (methods.md §4).
 * Compare the request's observed character-class counts with the counts expected from the
 * model's learned ratios; return the statistic, degrees of freedom and p-value.
 *
 * Implementation notes (standards §3): bin/merge classes with expected count < 5, apply a
 * continuity correction where appropriate, and compute the p-value from the chi-square survival
 * function at df (no external stats library in core — tech-stack §3).
 *
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ chiSquare: number, df: number, pValue: number }}
 */
// eslint-disable-next-line no-unused-vars
export function chiSquareScore(model, request) {
  // TODO(C-03): implement the chi-square character-distribution test with binning + p-value.
  throw new Error('chiSquareScore not implemented yet (backlog C-03)');
}

/**
 * Combine the available statistical signals into a single anomaly score (higher = more
 * anomalous). The caller applies a threshold. For now this returns the baseline length z-score
 * and the parts it used; wire in chiSquareScore and the outlier methods in C-06.
 * @param {StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ score: number, parts: Record<string, number> }}
 */
export function scoreRequest(model, request) {
  const z = lengthZScore(model, request);
  // TODO(C-06): once C-03/C-05 land, combine chiSquareScore + outlier scores here.
  return { score: z, parts: { lengthZScore: z } };
}
