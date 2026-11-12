// Build a labelled, reproducible dataset in three splits (ADR-004, ADR-009):
//   train        legitimate only — fits the statistical model;
//   calibration  legitimate only, never used for fitting — fixes the decision threshold at a
//                target false-positive rate;
//   test         legitimate + attacks — scored once, with that threshold.
// Labels and variants drive evaluation, never training. `prevalence` is the attack base rate of
// the TEST set, so it feeds the base-rate analysis directly (methods.md §7). Pure, runtime-agnostic.

import { createRng } from './rng.js';
import { makeLegitRequest, makeAttackRequest } from './generators.js';
import { HARD_CASES } from './hard-cases.js';

/**
 * @typedef {Object} Sample
 * @property {import('@anomaly-guard/core').AgRequest} request
 * @property {'legit' | 'attack'} label  drives evaluation only, never training
 * @property {string} kind  legit: the request kind (search, login, …); attack: the family (sqli, …)
 * @property {'typical' | 'hard' | 'canonical' | 'obfuscated' | 'novel'} variant  see ADR-006
 */

/**
 * @param {Object} opts
 * @param {number} opts.seed                    unsigned 32-bit integer RNG seed (recorded with results)
 * @param {number} [opts.trainSize=500]         legitimate samples for fitting the model
 * @param {number} [opts.calibrationSize=500]   legitimate samples for choosing the threshold
 *   (use ≥ 1000 when the target FPR is 1% or lower, or the quantile is too noisy)
 * @param {number} [opts.testSize=500]          samples in the test set
 * @param {number} [opts.prevalence=0.1]        attack base rate of the TEST set (0..1)
 * @param {number} [opts.hardShare=0]           fraction of legitimate TEST samples from fixtures (0..1)
 * @returns {{ seed: number, train: Sample[], calibration: Sample[], test: Sample[] }}
 *   `train` and `calibration` are legit-only; `test` has round(testSize·prevalence) attacks.
 *   Sizes must be non-negative safe integers; seed and shares are validated before generation.
 */
export function buildDataset({
  seed,
  trainSize = 500,
  calibrationSize = 500,
  testSize = 500,
  prevalence = 0.1,
  hardShare = 0,
} = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  for (const [name, size] of Object.entries({ trainSize, calibrationSize, testSize })) {
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer`);
    }
  }
  if (!Number.isFinite(prevalence) || prevalence < 0 || prevalence > 1) {
    throw new RangeError('prevalence must be a finite number between 0 and 1');
  }
  if (!Number.isFinite(hardShare) || hardShare < 0 || hardShare > 1) {
    throw new RangeError('hardShare must be a finite number between 0 and 1');
  }
  const rng = createRng(seed);

  /** @type {Sample[]} */
  const train = Array.from({ length: trainSize }, () => makeLegitRequest(rng));
  /** @type {Sample[]} */
  const calibration = Array.from({ length: calibrationSize }, () => makeLegitRequest(rng));

  const attackCount = Math.round(testSize * prevalence);
  const legitCount = testSize - attackCount;
  const hardCount = Math.round(legitCount * hardShare);
  /** @type {Sample[]} */
  const testLegit = Array.from({ length: legitCount - hardCount }, () => makeLegitRequest(rng));
  const testHard = Array.from({ length: hardCount }, () => {
    const sample = rng.pick(HARD_CASES);
    return { ...sample, request: { ...sample.request, params: { ...sample.request.params } } };
  });
  /** @type {Sample[]} */
  const testAttacks = Array.from({ length: attackCount }, () => makeAttackRequest(rng));
  const test = shuffle([...testLegit, ...testHard, ...testAttacks], rng);

  return { seed, train, calibration, test };
}

/**
 * Deterministic Fisher–Yates shuffle driven by the seeded RNG.
 * @template T @param {T[]} arr @param {import('./rng.js').Rng} rng @returns {T[]}
 */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
