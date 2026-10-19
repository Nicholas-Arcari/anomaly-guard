// Seeded pseudo-random generator so every dataset and every reported result is reproducible
// (standards §3/§4). Deterministic: same seed → same sequence. Pure, runtime-agnostic.
//
// mulberry32 — a small, fast, well-known 32-bit PRNG. Good enough for generating test traffic;
// it is NOT cryptographically secure and must not be used for anything security-sensitive.

/**
 * @typedef {Object} Rng
 * @property {() => number} next          float in [0, 1)
 * @property {(lo:number, hi:number) => number} int   integer in [lo, hi]
 * @property {<T>(items: T[]) => T} pick   a uniformly random element
 * @property {() => number} seed           the seed this generator was created with
 */

/**
 * Create a seeded RNG.
 * @param {number} seed  a 32-bit unsigned integer seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    seed: () => seed >>> 0,
  };
}
