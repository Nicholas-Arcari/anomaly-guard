import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcnemarTest, mcnemarFromCounts } from '../src/index.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

/** Exact two-sided p, 2·P(X ≤ min) for X ~ Binomial(n, ½), from BigInt binomial coefficients. */
function exactByCounting(onlyA, onlyB) {
  const n = onlyA + onlyB;
  let coefficient = 1n;
  let sum = 0n;
  for (let i = 0; i <= Math.min(onlyA, onlyB); i++) {
    if (i > 0) coefficient = (coefficient * BigInt(n - i + 1)) / BigInt(i);
    sum += coefficient;
  }
  const scale = 10n ** 40n;
  return Math.min(1, Number((2n * sum * scale) / (1n << BigInt(n))) / 1e40);
}

/** Seeded linear congruential generator, so that the tests are reproducible. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('mcnemarFromCounts: known answers', () => {
  const all = mcnemarFromCounts(10, 0); // ten disagreements, all one way
  near(all.exactP, 2 / 1024, 1e-15, 'exact p = 2 · (½)^10');
  near(all.chiSquare, 8.1, 1e-12, 'χ² = (10 − 1)² / 10');
  near(all.chiSquareP, 0.0044265, 1e-6, 'P(χ²₁ ≥ 8.1)');
  const even = mcnemarFromCounts(5, 5);
  assert.deepEqual([even.exactP, even.chiSquare, even.chiSquareP], [1, 0, 1]);
  assert.deepEqual(mcnemarFromCounts(0, 0), {
    onlyA: 0,
    onlyB: 0,
    exactP: 1,
    chiSquare: 0,
    chiSquareP: 1,
  });
});

test('mcnemarFromCounts: the exact p equals the binomial sum, and χ² gets close for large n', () => {
  for (const [a, b] of [
    [25, 10],
    [3, 9],
    [40, 60],
    [0, 7],
    [150, 86],
    [520, 600],
  ]) {
    const result = mcnemarFromCounts(a, b);
    const expected = exactByCounting(a, b);
    near(result.exactP, expected, 1e-12 * Math.max(1, expected) + 1e-15, `${a}/${b}`);
    assert.equal(mcnemarFromCounts(b, a).exactP, result.exactP, 'symmetric');
  }
  const large = mcnemarFromCounts(520, 600);
  near(large.chiSquareP / large.exactP, 1, 0.05, 'χ² ≈ exact for n = 1,120');
});

test('mcnemarTest: counts only the requests where the two disagree', () => {
  const a = [true, true, false, false, true, false];
  const b = [true, false, true, false, false, false];
  const result = mcnemarTest(a, b);
  assert.equal(result.onlyA, 2);
  assert.equal(result.onlyB, 1);
  assert.deepEqual(result, mcnemarFromCounts(2, 1));
  const swapped = mcnemarTest(b, a);
  assert.deepEqual([swapped.onlyA, swapped.onlyB, swapped.exactP], [1, 2, result.exactP]);
});

test('mcnemarTest: two equally good detectors are rejected at most 5% of the time', () => {
  // Under the null hypothesis each disagreement is a coin flip. The exact test is conservative:
  // with 2,000 simulated comparisons it rejects at most about 5% of them.
  const random = lcg(7);
  let rejected = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    const a = Array.from({ length: 60 }, () => random() < 0.3);
    const b = Array.from({ length: 60 }, () => random() < 0.3);
    if (mcnemarTest(a, b).exactP < 0.05) rejected++;
  }
  assert.ok(rejected / trials <= 0.06, `rejection rate ${rejected / trials}`);
});

test('mcnemarTest: a real difference is found', () => {
  const random = lcg(11);
  const a = Array.from({ length: 400 }, () => random() < 0.6);
  const b = a.map((value) => value && random() < 0.7); // B misses 30% of what A finds
  assert.ok(mcnemarTest(a, b).exactP < 1e-6);
});

test('mcnemarTest and mcnemarFromCounts: reject bad input', () => {
  assert.throws(() => mcnemarTest([true], [true, false]), RangeError);
  assert.throws(() => mcnemarTest('ab', 'ab'), RangeError);
  assert.throws(() => mcnemarFromCounts(-1, 3), RangeError);
  assert.throws(() => mcnemarFromCounts(1.5, 3), RangeError);
});
