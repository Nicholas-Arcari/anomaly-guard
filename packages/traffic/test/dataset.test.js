import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, buildDataset, makeLegitRequest } from '../src/index.js';
import { HARD_CASES } from '../src/hard-cases.js';

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

test('buildDataset: prevalence boundaries keep training and calibration legitimate', () => {
  for (const prevalence of [0, 1]) {
    const options = { seed: 42, trainSize: 10, calibrationSize: 10, testSize: 30, prevalence };
    const dataset = buildDataset(options);
    assert.deepEqual(dataset, buildDataset(options));
    assert.ok(dataset.train.every((sample) => sample.label === 'legit'));
    assert.ok(dataset.calibration.every((sample) => sample.label === 'legit'));
    assert.equal(
      dataset.test.filter((sample) => sample.label === 'attack').length,
      30 * prevalence,
    );
  }
});

test('buildDataset: is reproducible for a fixed seed', () => {
  const d1 = buildDataset({ seed: 999, trainSize: 100, testSize: 100 });
  const d2 = buildDataset({ seed: 999, trainSize: 100, testSize: 100 });
  assert.deepEqual(d1.test[0], d2.test[0]);
  assert.deepEqual(d1.train.at(-1), d2.train.at(-1));
});

test('hard fixtures are legitimate requests with existing endpoint shapes and varied inputs', () => {
  assert.equal(HARD_CASES.length, 4);
  const rng = createRng(12);
  const shapes = new Set(
    Array.from({ length: 3000 }, () => makeLegitRequest(rng)).map(
      ({ request }) => `${request.method} ${request.path} ${Object.keys(request.params).sort()}`,
    ),
  );
  for (const sample of HARD_CASES) {
    assert.equal(sample.label, 'legit');
    assert.equal(sample.variant, 'hard');
    assert.equal(sample.kind, sample.request.path.slice(1));
    assert.ok(
      shapes.has(
        `${sample.request.method} ${sample.request.path} ${Object.keys(sample.request.params).sort()}`,
      ),
    );
    assert.ok(Object.values(sample.request.params).every((value) => typeof value === 'string'));
  }
  const values = HARD_CASES.flatMap(({ request }) => Object.values(request.params));
  assert.ok(values.some((value) => value.includes("O'Brien")));
  assert.ok(values.some((value) => value.includes('東京') && value.includes('مرحبا')));
  assert.ok(values.some((value) => value.length >= 1000));
});

test('hardShare mixes an exact share of legitimate test samples, with no split leakage', () => {
  const options = {
    seed: 42,
    trainSize: 50,
    calibrationSize: 50,
    testSize: 100,
    prevalence: 0.1,
    hardShare: 0.1,
  };
  const dataset = buildDataset(options);
  assert.deepEqual(dataset, buildDataset(options));
  assert.equal(dataset.test.filter((sample) => sample.label === 'attack').length, 10);
  assert.equal(dataset.test.filter((sample) => sample.variant === 'hard').length, 9);
  assert.equal(dataset.test.filter((sample) => sample.variant === 'typical').length, 81);
  assert.ok(
    dataset.train.every((sample) => sample.label === 'legit' && sample.variant === 'typical'),
  );
  assert.ok(
    dataset.calibration.every((sample) => sample.label === 'legit' && sample.variant === 'typical'),
  );
  assert.ok(
    dataset.test
      .filter((sample) => sample.variant === 'hard')
      .every((sample) =>
        HARD_CASES.some((fixture) => JSON.stringify(fixture) === JSON.stringify(sample)),
      ),
  );
});

test('hardShare boundaries, rounding and monotonicity preserve attack counts', () => {
  const counts = [0, 0.1, 0.5, 1].map((hardShare) => {
    const { test: samples } = buildDataset({
      seed: 7,
      trainSize: 0,
      calibrationSize: 0,
      testSize: 10,
      prevalence: 0.5,
      hardShare,
    });
    assert.equal(samples.filter((sample) => sample.label === 'attack').length, 5);
    return samples.filter((sample) => sample.variant === 'hard').length;
  });
  assert.deepEqual(counts, [0, 1, 3, 5]); // round(5 × share), including halves
  assert.deepEqual(
    buildDataset({ seed: 1, trainSize: 0, calibrationSize: 0, testSize: 0, hardShare: 1 }).test,
    [],
  );
  assert.equal(
    buildDataset({
      seed: 1,
      trainSize: 0,
      calibrationSize: 0,
      testSize: 10,
      prevalence: 1,
      hardShare: 1,
    }).test.filter((s) => s.variant === 'hard').length,
    0,
  );
  for (const hardShare of [-0.1, 1.1, NaN, Infinity, '0.1', null]) {
    assert.throws(() => buildDataset({ seed: 1, hardShare }), RangeError);
  }
});

test('hard fixtures are sampled uniformly with replacement and copied independently', () => {
  const options = {
    seed: 91,
    trainSize: 0,
    calibrationSize: 0,
    testSize: 4000,
    prevalence: 0,
    hardShare: 1,
  };
  const { test: samples } = buildDataset(options);
  for (const fixture of HARD_CASES) {
    const matching = samples.filter((sample) => JSON.stringify(sample) === JSON.stringify(fixture));
    assert.ok(Math.abs(matching.length / samples.length - 0.25) < 0.03);
    assert.ok(matching.length > 1);
    const before = matching[1].request.params;
    const original = { ...before };
    matching[0].request.params[Object.keys(matching[0].request.params)[0]] = 'changed';
    assert.deepEqual(before, original);
    assert.deepEqual(fixture.request.params, original);
  }
  assert.deepEqual(buildDataset(options), buildDataset(options));
});
