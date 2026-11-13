import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meanInterval, studentTQuantile, Z_95 } from '../src/index.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);

/** Seeded linear congruential generator, so that the tests are reproducible. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296; // never exactly 0, so the logarithm below stays finite
  };
}

/** Standard normal draws (Box–Muller). */
function normals(random, n) {
  return Array.from(
    { length: n },
    () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random()),
  );
}

test('studentTQuantile: matches the closed forms for 1 and 2 degrees of freedom', () => {
  for (const p of [0.6, 0.9, 0.975, 0.995]) {
    // df = 1 is the Cauchy distribution; df = 2 has F(t) = ½ + t / (2√(2 + t²)).
    near(studentTQuantile(p, 1), Math.tan(Math.PI * (p - 0.5)), 1e-9, `df 1, p ${p}`);
    near(studentTQuantile(p, 2), (2 * p - 1) / Math.sqrt(2 * p * (1 - p)), 1e-9, `df 2, p ${p}`);
  }
});

test('studentTQuantile: matches the t table and tends to the normal quantile', () => {
  near(studentTQuantile(0.975, 4), 2.776445105, 1e-8, 'df 4');
  near(studentTQuantile(0.975, 5), 2.570581836, 1e-8, 'df 5');
  near(studentTQuantile(0.975, 19), 2.093024054, 1e-8, 'df 19 (20 seeds)');
  near(studentTQuantile(0.975, 30), 2.042272456, 1e-8, 'df 30');
  near(studentTQuantile(0.995, 10), 3.169272673, 1e-8, 'df 10, 99%');
  near(studentTQuantile(0.975, 1e6), Z_95, 1e-5, 'df 1e6 ≈ normal');
  assert.equal(studentTQuantile(0.5, 7), 0);
  assert.equal(studentTQuantile(0.025, 19), -studentTQuantile(0.975, 19));
});

test('studentTQuantile: rejects bad arguments', () => {
  for (const [p, df] of [
    [0, 5],
    [1, 5],
    [Number.NaN, 5],
    [0.975, 0],
    [0.975, -1],
    [0.975, Infinity],
  ]) {
    assert.throws(() => studentTQuantile(p, df), RangeError, `p ${p}, df ${df}`);
  }
});

test('meanInterval: known answer', () => {
  const ci = meanInterval([1, 2, 3, 4, 5]);
  assert.equal(ci.estimate, 3);
  near(ci.sd, Math.sqrt(2.5), 1e-12, 'sd');
  const half = (2.776445105 * Math.sqrt(2.5)) / Math.sqrt(5); // t(0.975, 4) · SD / √n
  near(ci.lower, 3 - half, 1e-8, 'lower');
  near(ci.upper, 3 + half, 1e-8, 'upper');
  assert.deepEqual([ci.n, ci.min, ci.max, ci.level], [5, 1, 5, 0.95]);
});

test('meanInterval: identical values give zero width; the range clips the interval', () => {
  const same = meanInterval([0.1, 0.1, 0.1]);
  assert.deepEqual([same.lower, same.estimate, same.upper, same.sd], [0.1, 0.1, 0.1, 0]);
  const rates = [0.002, 0, 0, 0.001, 0]; // rare false positives: the t-interval would cross 0
  const unclipped = meanInterval(rates);
  assert.ok(unclipped.lower < 0);
  const clipped = meanInterval(rates, { range: [0, 1] });
  assert.equal(clipped.lower, 0);
  assert.equal(clipped.upper, unclipped.upper);
});

test('meanInterval: about 95% of the intervals cover the true mean', () => {
  // 2,000 samples of size 10 from a normal with mean 5: the coverage should be close to 95%.
  // (With 1.96 in place of t(0.975, 9) = 2.262 it would be about 92%.)
  const random = lcg(2026);
  let covered = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    const ci = meanInterval(normals(random, 10).map((z) => 5 + 2 * z));
    if (ci.lower <= 5 && 5 <= ci.upper) covered++;
  }
  const coverage = covered / trials;
  assert.ok(coverage > 0.935 && coverage < 0.965, `coverage ${coverage}`);
});

test('meanInterval: rejects bad input', () => {
  assert.throws(() => meanInterval([1]), RangeError);
  assert.throws(() => meanInterval('12'), RangeError);
  assert.throws(() => meanInterval([1, Number.NaN]), RangeError);
  assert.throws(() => meanInterval([1, Infinity]), RangeError);
  assert.throws(() => meanInterval([1, 2], { level: 1 }), RangeError);
});
