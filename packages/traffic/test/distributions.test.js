import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, makeLegitRequest, buildDataset } from '../src/index.js';
import { weightedIndex, geometric, standardNormal, textLength } from '../src/distributions.js';

const fixed = (...values) => ({ next: () => values.shift() });
const close = (actual, expected, tolerance) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} not within ${tolerance} of ${expected}`,
  );

test('inverse CDFs have known answers and respect boundaries', () => {
  const weights = [1, 1 / 2, 1 / 3]; // probabilities 6/11, 3/11, 2/11
  assert.equal(weightedIndex(fixed(0), weights), 0);
  assert.equal(weightedIndex(fixed(0.54), weights), 0);
  assert.equal(weightedIndex(fixed(0.55), weights), 1);
  assert.equal(weightedIndex(fixed(0.82), weights), 2);
  assert.equal(geometric(fixed(0), 0.5), 1);
  assert.equal(geometric(fixed(0.5), 0.5), 2);
  assert.equal(geometric(fixed(0.75), 0.5), 3);
  assert.equal(geometric(fixed(0.99), 1), 1);
  assert.throws(() => geometric(fixed(0), 0), RangeError);
  assert.throws(() => geometric(fixed(0), 1.1), RangeError);
  assert.ok(geometric(fixed(0.9), 0.5) > geometric(fixed(0.1), 0.5));
});

test('Box–Muller and bounded log-normal lengths have known answers', () => {
  close(standardNormal(fixed(1 - Math.exp(-0.5), 0)), 1, 1e-12);
  assert.equal(textLength(fixed(0, 0)), 100);
  assert.equal(textLength(fixed(1 - Math.exp(-0.5), 0)), 332);
  assert.equal(textLength(fixed(1 - 2 ** -32, 0)), 4096);
  assert.equal(textLength(fixed(1 - 2 ** -32, 0.5)), 1);
});

test('seeded distribution samples match expected probabilities, means and quantiles', () => {
  const rng = createRng(42);
  const n = 30000;
  const ranks = [0, 0, 0];
  const pages = [];
  const lengths = [];
  for (let i = 0; i < n; i++) {
    ranks[weightedIndex(rng, [1, 1 / 2, 1 / 3])]++;
    pages.push(geometric(rng, 0.5));
    lengths.push(textLength(rng));
  }
  ranks.forEach((count, i) => close(count / n, [6 / 11, 3 / 11, 2 / 11][i], 0.015));
  close(pages.reduce((a, b) => a + b, 0) / n, 2, 0.05);
  close(pages.filter((x) => x <= 2).length / n, 0.75, 0.015);
  lengths.sort((a, b) => a - b);
  close(lengths[Math.floor(n * 0.5)], 100, 5);
  close(lengths[Math.floor(n * 0.9)], 465.6, 25);
  // The 4096 cap slightly reduces the unbounded theoretical mean exp(log(100)+1.2²/2)=205.44.
  close(lengths.reduce((a, b) => a + b, 0) / n, 205.4, 15);
  assert.ok(lengths.filter((x) => x >= 1000).length > n * 0.02);
});

test('generated requests follow the endpoint mix and have varied, valid fields', () => {
  const rng = createRng(818);
  const n = 20000;
  const counts = {};
  const bodies = [];
  const pages = [];
  const allValues = [];
  for (let i = 0; i < n; i++) {
    const { request } = makeLegitRequest(rng);
    counts[request.path] = (counts[request.path] || 0) + 1;
    allValues.push(...Object.values(request.params));
    if (request.path === '/comments') bodies.push(request.params.body.length);
    if (request.path === '/search') pages.push(Number(request.params.page));
    if (request.path === '/profile') assert.match(request.params.email, /^[a-z0-9]+@example\.com$/);
    if (request.path === '/login')
      assert.ok(request.params.pass.length >= 8 && request.params.pass.length <= 24);
  }
  for (const [path, share] of Object.entries({
    '/search': 0.25,
    '/products': 0.2,
    '/cart': 0.15,
    '/login': 0.15,
    '/profile': 0.1,
    '/comments': 0.15,
  })) {
    close(counts[path] / n, share, 0.015);
  }
  close(pages.reduce((a, b) => a + b, 0) / pages.length, 1 / 0.35, 0.15);
  bodies.sort((a, b) => a - b);
  close(bodies[Math.floor(bodies.length * 0.5)], 100, 12);
  assert.ok(bodies.some((x) => x >= 1000));
  const combined = allValues.join(' ');
  for (const value of [
    "O'Brien",
    'café',
    '東京',
    'مرحبا',
    'https://example.com/item',
    '2026-11-01',
  ]) {
    assert.ok(combined.includes(value), `missing ${value}`);
  }
});

test('all splits use the same legitimate generator, without changing reproducibility or labels', () => {
  const options = {
    seed: 93,
    trainSize: 3000,
    calibrationSize: 3000,
    testSize: 3000,
    prevalence: 0,
  };
  const dataset = buildDataset(options);
  assert.deepEqual(dataset, buildDataset(options));
  for (const split of [dataset.train, dataset.calibration, dataset.test]) {
    assert.ok(split.every((sample) => sample.label === 'legit' && sample.variant === 'typical'));
    close(
      split.filter((sample) => sample.request.path === '/search').length / split.length,
      0.25,
      0.035,
    );
    assert.ok(split.some((sample) => (sample.request.params.body || '').length >= 1000));
  }
});
