import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, buildDataset } from '../src/index.js';

test('createRng: same seed produces the same sequence (reproducible)', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = Array.from({ length: 5 }, () => a.next());
  const seqB = Array.from({ length: 5 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('createRng: different seeds differ', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a.next(), b.next());
});

test('createRng: next() stays in [0, 1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1);
  }
});

test('buildDataset: train and calibration splits are legitimate only (no label leakage)', () => {
  const { train, calibration } = buildDataset({
    seed: 123,
    trainSize: 200,
    calibrationSize: 150,
    testSize: 100,
    prevalence: 0.2,
  });
  assert.equal(train.length, 200);
  assert.equal(calibration.length, 150);
  assert.ok(train.every((s) => s.label === 'legit'));
  assert.ok(calibration.every((s) => s.label === 'legit'));
});

test('buildDataset: test split honours the requested prevalence (base rate)', () => {
  const { test: testSet } = buildDataset({
    seed: 123,
    trainSize: 400,
    testSize: 1000,
    prevalence: 0.1,
  });
  const attacks = testSet.filter((s) => s.label === 'attack').length;
  assert.equal(testSet.length, 1000);
  assert.equal(attacks, 100); // round(1000 · 0.1)
});

test('buildDataset: is reproducible for a fixed seed', () => {
  const d1 = buildDataset({ seed: 999, trainSize: 100, testSize: 100 });
  const d2 = buildDataset({ seed: 999, trainSize: 100, testSize: 100 });
  assert.deepEqual(d1.test[0], d2.test[0]);
  assert.deepEqual(d1.train.at(-1), d2.train.at(-1));
});
