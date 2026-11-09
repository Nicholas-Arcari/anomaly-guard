// Length signal (C-04): how far a value's length is from what its (path, parameter) pair receives
// in normal traffic (methods.md §3). BASELINE in place: the Chebyshev bound. Pure,
// runtime-agnostic.

import { extractFeatures } from '../features/extract.js';
import { paramKey, pToScore } from './model.js';

/**
 * Largest standardised length deviation z = |x − μ| / σ across the request's parameters, using
 * the statistics of each (path, parameter) pair. Pairs unseen in training, or with σ = 0, are
 * skipped for now; the policy for them is decided in C-04.
 * @param {import('./model.js').StatModel} model
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
 * @param {import('./model.js').StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ score: number, z: number, param: string | null }}
 */
export function lengthScore(model, request) {
  const { z, param } = lengthZScore(model, request);
  return { score: pToScore(1 / (z * z)), z, param };
}
