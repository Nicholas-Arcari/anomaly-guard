import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confusionMatrix, metrics, evaluateAt, positivePredictiveValue } from '../src/index.js';

test('confusionMatrix: counts tp/fp/tn/fn', () => {
  //            pred:  T  F  T  F
  const predicted = [true, false, true, false];
  const actual = [true, true, false, false];
  const cm = confusionMatrix(predicted, actual);
  assert.deepEqual(cm, { tp: 1, fn: 1, fp: 1, tn: 1 });
});

test('confusionMatrix: rejects mismatched lengths', () => {
  assert.throws(() => confusionMatrix([true], [true, false]));
});

test('metrics: a perfect classifier', () => {
  const m = metrics({ tp: 10, fp: 0, tn: 10, fn: 0 });
  assert.equal(m.precision, 1);
  assert.equal(m.recall, 1);
  assert.equal(m.f1, 1);
  assert.equal(m.fpr, 0);
  assert.equal(m.fnr, 0);
});

test('metrics: FPR and FNR are computed, not just accuracy', () => {
  const m = metrics({ tp: 8, fp: 5, tn: 95, fn: 2 });
  assert.ok(Math.abs(m.recall - 8 / 10) < 1e-12);
  assert.ok(Math.abs(m.fpr - 5 / 100) < 1e-12);
  assert.ok(Math.abs(m.fnr - 2 / 10) < 1e-12);
});

test('evaluateAt: thresholds scores (attack when score ≥ t)', () => {
  const scored = [
    { label: 'attack', score: 5 },
    { label: 'attack', score: 1 }, // missed at t=3 → fn
    { label: 'legit', score: 4 }, // false alarm at t=3 → fp
    { label: 'legit', score: 0 },
  ];
  const r = evaluateAt(scored, 3);
  assert.deepEqual(r.confusion, { tp: 1, fn: 1, fp: 1, tn: 1 });
});

test('positivePredictiveValue: base-rate fallacy worked example', () => {
  // TPR 0.99, FPR 0.01, prevalence 0.001 → PPV ≈ 0.09 (methods.md §7)
  const ppv = positivePredictiveValue(0.99, 0.01, 0.001);
  assert.ok(Math.abs(ppv - 0.0902) < 0.001, `PPV was ${ppv}`);
});

test('positivePredictiveValue: with no attacks in the population it is 0', () => {
  assert.equal(positivePredictiveValue(0.99, 0.01, 0), 0);
});
