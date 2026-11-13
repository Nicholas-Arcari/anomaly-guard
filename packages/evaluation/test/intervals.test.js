import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wilsonInterval, bootstrapAucInterval, rocCurve, Z_95 } from '../src/index.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);

/** Seeded linear congruential generator, so that the tests are reproducible. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Scored samples: attacks and legitimate requests with overlapping normal-ish scores. */
function overlapping(random, attacks, legit, shift = 1) {
  const noisy = () => random() + random() + random(); // sum of uniforms: bell-shaped
  return [
    ...Array.from({ length: attacks }, () => ({ label: 'attack', score: noisy() + shift })),
    ...Array.from({ length: legit }, () => ({ label: 'legit', score: noisy() })),
  ];
}

test('wilsonInterval: known answers', () => {
  const half = wilsonInterval(5, 10);
  near(half.lower, 0.2366, 1e-4, '5/10 lower');
  near(half.upper, 0.7634, 1e-4, '5/10 upper');
  const all = wilsonInterval(10, 10);
  near(all.lower, 0.7225, 1e-4, '10/10 lower');
  assert.equal(all.upper, 1);
  const none = wilsonInterval(0, 900); // methods.md §6: FPR ∈ [0, 0.43%], not "zero"
  assert.equal(none.lower, 0);
  near(none.upper, 0.00425, 1e-5, '0/900 upper');
  assert.equal(none.estimate, 0);
});

test('wilsonInterval: contains the estimate, stays in [0, 1], mirrors x ↔ n − x, narrows with n', () => {
  for (const n of [1, 7, 50, 900]) {
    for (let x = 0; x <= n; x += Math.max(1, Math.floor(n / 9))) {
      const ci = wilsonInterval(x, n);
      assert.ok(ci.lower <= ci.estimate && ci.estimate <= ci.upper, `${x}/${n}`);
      assert.ok(ci.lower >= 0 && ci.upper <= 1);
      const mirror = wilsonInterval(n - x, n);
      near(ci.lower, 1 - mirror.upper, 1e-12, `${x}/${n} mirror`);
    }
  }
  const small = wilsonInterval(10, 100);
  const large = wilsonInterval(100, 1000);
  assert.ok(large.upper - large.lower < small.upper - small.lower);
  // A larger z (more confidence) gives a wider interval.
  assert.ok(
    wilsonInterval(10, 100, { z: 2.576 }).upper > wilsonInterval(10, 100, { z: Z_95 }).upper,
  );
});

test('wilsonInterval: rejects impossible counts', () => {
  assert.throws(() => wilsonInterval(0, 0), RangeError);
  assert.throws(() => wilsonInterval(5, 4), RangeError);
  assert.throws(() => wilsonInterval(-1, 4), RangeError);
  assert.throws(() => wilsonInterval(1.5, 4), RangeError);
  assert.throws(() => wilsonInterval(1, 4, { z: 0 }), RangeError);
});

test('bootstrapAucInterval: reproducible with the same seed, different with another', () => {
  const scored = overlapping(lcg(1), 60, 240);
  const a = bootstrapAucInterval(scored, { random: lcg(42), resamples: 300 });
  const b = bootstrapAucInterval(scored, { random: lcg(42), resamples: 300 });
  const c = bootstrapAucInterval(scored, { random: lcg(43), resamples: 300 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('bootstrapAucInterval: brackets the AUC of the test set and narrows with more data', () => {
  const small = overlapping(lcg(2), 40, 160);
  const large = overlapping(lcg(2), 400, 1600);
  const ciSmall = bootstrapAucInterval(small, { random: lcg(7), resamples: 400 });
  const ciLarge = bootstrapAucInterval(large, { random: lcg(7), resamples: 400 });
  for (const [ci, data] of [
    [ciSmall, small],
    [ciLarge, large],
  ]) {
    assert.equal(ci.estimate, rocCurve(data).auc);
    assert.ok(ci.lower <= ci.estimate && ci.estimate <= ci.upper, JSON.stringify(ci));
    assert.ok(ci.lower >= 0 && ci.upper <= 1);
  }
  assert.ok(ciLarge.upper - ciLarge.lower < ciSmall.upper - ciSmall.lower);
});

test('bootstrapAucInterval: perfect separation stays at AUC 1 in every resample', () => {
  const scored = [
    ...Array.from({ length: 30 }, (_, i) => ({ label: 'attack', score: 10 + i })),
    ...Array.from({ length: 70 }, (_, i) => ({ label: 'legit', score: i / 10 })),
  ];
  const ci = bootstrapAucInterval(scored, { random: lcg(9), resamples: 200 });
  assert.deepEqual([ci.lower, ci.estimate, ci.upper], [1, 1, 1]);
});

test('bootstrapAucInterval: needs a seeded random source and valid options', () => {
  const scored = overlapping(lcg(3), 10, 10);
  assert.throws(() => bootstrapAucInterval(scored, {}), RangeError);
  assert.throws(() => bootstrapAucInterval(scored, { random: lcg(1), resamples: 0 }), RangeError);
  assert.throws(() => bootstrapAucInterval(scored, { random: lcg(1), level: 1 }), RangeError);
  assert.throws(
    () => bootstrapAucInterval([{ label: 'attack', score: 1 }], { random: lcg(1) }),
    RangeError,
  );
});
