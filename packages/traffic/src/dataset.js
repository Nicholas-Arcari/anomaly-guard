// Build a labelled, reproducible dataset split into train (normal only) and test.
// The train split contains LEGITIMATE traffic only (ADR-004); labels drive evaluation, never
// training. `prevalence` is the attack base rate of the TEST set, so it feeds the base-rate
// analysis directly (methods.md §7). Pure, runtime-agnostic.

import { createRng } from './rng.js';
import { makeLegitRequest, makeAttackRequest } from './generators.js';

/** @typedef {{ request: import('@anomaly-guard/core').AgRequest, label: 'legit'|'attack', kind: string }} Sample */

/**
 * @param {Object} opts
 * @param {number} opts.seed             RNG seed (recorded with results)
 * @param {number} [opts.trainSize=500]  number of legitimate samples for training
 * @param {number} [opts.testSize=500]   number of samples in the test set
 * @param {number} [opts.prevalence=0.1] attack base rate of the TEST set (0..1)
 * @returns {{ seed:number, train: Sample[], test: Sample[] }}
 *   `train` is legit-only; `test` has round(testSize·prevalence) attacks and the rest legit.
 */
export function buildDataset({ seed, trainSize = 500, testSize = 500, prevalence = 0.1 } = {}) {
  const rng = createRng(seed);

  /** @type {Sample[]} */
  const train = Array.from({ length: trainSize }, () => makeLegitRequest(rng)); // legit only

  const attackCount = Math.round(testSize * prevalence);
  const legitCount = testSize - attackCount;
  /** @type {Sample[]} */
  const testLegit = Array.from({ length: legitCount }, () => makeLegitRequest(rng));
  /** @type {Sample[]} */
  const testAttacks = Array.from({ length: attackCount }, () => makeAttackRequest(rng));
  const test = shuffle([...testLegit, ...testAttacks], rng);

  return { seed, train, test };
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
