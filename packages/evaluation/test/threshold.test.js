import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdAtFpr, evaluateAt } from '../src/index.js';

/** Seeded linear congruential generator, so that the property tests are reproducible. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('thresholdAtFpr: known answer without ties (1..100, α = 5% flags the top 5)', () => {
  const scores = Array.from({ length: 100 }, (_, i) => i + 1);
  const r = thresholdAtFpr(scores, 0.05);
  assert.ok(r.threshold > 95 && r.threshold <= 96, `threshold ${r.threshold}`);
  assert.equal(r.calibrationFpr, 0.05);
  assert.equal(r.attainable, true);
  assert.equal(r.n, 100);
});

test('thresholdAtFpr: a tie that would exceed k stays below the threshold', () => {
  const scores = [5, 4, 4, 4, 1];
  // α = 40% allows k = 2, but the three 4s move together: only the 5 is flagged.
  const r = thresholdAtFpr(scores, 0.4);
  assert.ok(r.threshold > 4 && r.threshold <= 5);
  assert.equal(r.calibrationFpr, 0.2);
  // α = 80% allows k = 4: the 5 and all three 4s.
  assert.equal(thresholdAtFpr(scores, 0.8).calibrationFpr, 0.8);
});

test('thresholdAtFpr: α = 0 flags nothing, α = 1 flags everything', () => {
  const scores = [0.5, 2, 3.25];
  const none = thresholdAtFpr(scores, 0);
  assert.ok(none.threshold > 3.25);
  assert.equal(none.calibrationFpr, 0);
  const all = thresholdAtFpr(scores, 1);
  assert.equal(all.threshold, 0.5);
  assert.equal(all.calibrationFpr, 1);
});

test('thresholdAtFpr: the threshold is the smallest one that meets the target', () => {
  const random = lcg(7);
  for (let round = 0; round < 200; round++) {
    const n = 1 + Math.floor(random() * 300);
    // Rounded scores, so that ties are frequent.
    const scores = Array.from({ length: n }, () => Math.round(random() * 40) / 4);
    const alpha = Math.round(random() * 100) / 100;
    const k = Math.floor(alpha * n + 1e-9);
    const { threshold, calibrationFpr } = thresholdAtFpr(scores, alpha);
    const flagged = scores.filter((s) => s >= threshold).length;
    assert.ok(flagged <= k, `round ${round}: ${flagged} flagged, at most ${k} allowed`);
    assert.equal(calibrationFpr, flagged / n);
    // Using the highest score below the threshold as the threshold would flag more than k.
    const below = scores.filter((s) => s < threshold);
    if (below.length) {
      const highestBelow = Math.max(...below);
      assert.ok(scores.filter((s) => s >= highestBelow).length > k, `round ${round}: not minimal`);
    }
  }
});

test('thresholdAtFpr: rule hits on legitimate requests (+Infinity) can make the target unattainable', () => {
  const scores = [Infinity, 3, 2, 1];
  const r = thresholdAtFpr(scores, 0); // k = 0, but a rule hit is flagged at any threshold
  assert.ok(Number.isFinite(r.threshold) && r.threshold > 3);
  assert.equal(r.calibrationFpr, 0.25);
  assert.equal(r.attainable, false);
  // With room for it (k = 1) the target is met and the statistics flag nothing else.
  const ok = thresholdAtFpr(scores, 0.25);
  assert.equal(ok.attainable, true);
  assert.equal(ok.calibrationFpr, 0.25);
});

test('thresholdAtFpr: on fresh legitimate data the calibrated threshold gives about the target FPR', () => {
  const random = lcg(11);
  // A uniform tail probability p gives s = −log10(p), so P(s ≥ t) = 10^−t exactly.
  const legit = () => -Math.log10(random() || 1e-12);
  const calibration = Array.from({ length: 5000 }, legit);
  const { threshold } = thresholdAtFpr(calibration, 0.05);
  const fresh = Array.from({ length: 20000 }, () => ({ label: 'legit', score: legit() }));
  const r = evaluateAt(fresh, threshold);
  assert.ok(Math.abs(r.fpr - 0.05) < 0.01, `FPR on fresh data ${r.fpr}`);
});

test('thresholdAtFpr: rejects bad input', () => {
  assert.throws(() => thresholdAtFpr([], 0.01), RangeError);
  assert.throws(() => thresholdAtFpr([1, 2], -0.1), RangeError);
  assert.throws(() => thresholdAtFpr([1, 2], 1.5), RangeError);
  assert.throws(() => thresholdAtFpr([1, 2], Number.NaN), RangeError);
  assert.throws(() => thresholdAtFpr([1, Number.NaN], 0.1), RangeError);
});
