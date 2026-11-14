// Character-distribution signal (C-03) — the headline method (Kruegel & Vigna 2003, ADR-008,
// methods.md §4). The χ² survival function is computed here by hand: `core` uses no stats library.
// The dataset-level test of homogeneity (C-08, methods.md §4b) belongs here too. Pure,
// runtime-agnostic.
//
// Building blocks: extractFeatures (../features/extract.js) gives each parameter's observed class
// counts; paramKey (./model.js) gives the model key; CHAR_CLASSES (./entropy.js) fixes k = 7.

import { extractFeatures } from '../features/extract.js';
import { CHAR_CLASSES } from './entropy.js';
import { paramKey } from './model.js';

/** Degrees of freedom: k − 1, with k = 7 fixed character classes (ADR-008). */
const DF = CHAR_CLASSES.length - 1;

/**
 * Natural log of the χ²(6) survival function:
 * P(χ²(6) > x) = e^(−x/2) · (1 + x/2 + x²/8).
 * For an even df = 2m the survival function is e^(−x/2) · Σ_{j=0}^{m−1} (x/2)^j / j!, here m = 3.
 * Working in logs keeps s = −ln p / ln 10 finite when p underflows (methods.md §4, ADR-007).
 * x ≤ 0 gives p = 1: a chi-square statistic is non-negative, and zero is not extreme.
 * @param {number} x chi-square statistic (≥ 0)
 * @returns {number} ln P(χ²(6) > x) ≤ 0
 */
export function chiSquare6LogSurvival(x) {
  if (!(x > 0)) return 0;
  if (!Number.isFinite(x)) return -Infinity;
  const half = x / 2;
  // ln(1 + half + half²/2); the branch avoids overflow of half² for absurd inputs.
  const logPolynomial =
    half > 1e150 ? 2 * Math.log(half) - Math.LN2 : Math.log1p(half + (half * half) / 2);
  return -half + logPolynomial;
}

/**
 * HEADLINE METHOD — chi-square score on the character distribution (methods.md §4, ADR-008).
 * For each parameter value with N > 0 characters: observed class counts O_i against expected
 * E_i = N · p̂_i, with Laplace-smoothed p̂_i = (c_i + 1) / (C + k) from the pair's training counts
 * (the pooled counts if the pair is unseen), so E_i > 0 always. χ² = Σ (O_i − E_i)² / E_i with
 * df = k − 1 = 6; no class merging, no Yates correction. The p-value from the χ²(6) survival
 * function is NOMINAL (the E_i are small), so it is used only as a score, s = −log10(p), computed
 * in log space so it cannot underflow. Report the most anomalous parameter; values with N = 0
 * carry no character evidence and are skipped.
 *
 * @param {import('./model.js').StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ chiSquare: number, df: number, pValue: number, score: number, param: string | null }}
 */
export function chiSquareScore(model, request) {
  const f = extractFeatures(request);
  let chiSquare = 0;
  /** @type {string | null} */
  let param = null;

  for (const p of f.params) {
    const n = p.length;
    if (n === 0) continue;

    const stats = model.params[paramKey(f.path, p.name)];
    const counts = stats ? stats.classCounts : model.classCounts;
    let total = 0;
    for (const cls of CHAR_CLASSES) total += counts[cls] ?? 0;

    let observedChiSquare = 0;
    for (const cls of CHAR_CLASSES) {
      const smoothed = (counts[cls] ?? 0) + 1;
      const expected = (n * smoothed) / (total + CHAR_CLASSES.length);
      const difference = (p.classCounts[cls] ?? 0) - expected;
      observedChiSquare += (difference * difference) / expected;
    }

    if (param === null || observedChiSquare > chiSquare) {
      chiSquare = observedChiSquare;
      param = p.name;
    }
  }

  const logP = chiSquare6LogSurvival(chiSquare);
  return {
    chiSquare,
    df: DF,
    pValue: Math.exp(logP),
    score: logP === 0 ? 0 : -logP / Math.LN10,
    param,
  };
}
