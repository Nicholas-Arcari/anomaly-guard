// Sampling primitives for the synthetic traffic model in methods.md §0.

/** Select an index by positive weights using an inverse cumulative distribution. */
export function weightedIndex(rng, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = rng.next() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) return i;
  }
  return weights.length - 1;
}

/** Sample a geometric distribution on 1, 2, ... using its inverse CDF. */
export function geometric(rng, p) {
  if (!(p > 0 && p <= 1)) throw new RangeError('p must be in (0, 1]');
  if (p === 1) return 1;
  return Math.floor(Math.log1p(-rng.next()) / Math.log1p(-p)) + 1;
}

/** Sample a standard normal using Box–Muller; 1 - U avoids log(0). */
export function standardNormal(rng) {
  const u1 = 1 - rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sample a rounded, bounded log-normal text length in UTF-16 code units. */
export function textLength(rng) {
  return Math.min(
    4096,
    Math.max(1, Math.round(Math.exp(Math.log(100) + 1.2 * standardNormal(rng)))),
  );
}
