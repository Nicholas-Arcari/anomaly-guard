import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  trainStatModel,
  scoreRequest,
  paramKey,
  pToScore,
  lengthZScore,
  lengthScore,
} from '../src/index.js';

const get = (path, params) => ({ method: 'GET', path, params });

// Lengths 3, 5, 4 → mean 4, sample std 1: easy known answers.
const model = trainStatModel([
  get('/search', { q: 'abc' }),
  get('/search', { q: 'abcde' }),
  get('/search', { q: 'abcd' }),
]);

test('trainStatModel: learns length stats per (path, parameter) pair', () => {
  assert.equal(model.trainedOn, 3);
  const q = model.params[paramKey('/search', 'q')];
  assert.equal(q.n, 3);
  assert.equal(q.length.mean, 4);
  assert.equal(q.length.std, 1);
});

test('trainStatModel: the same name on two paths gets two separate models (ADR-007)', () => {
  const m = trainStatModel([
    get('/search', { q: 'ab' }),
    get('/help', { q: 'a much longer text' }),
  ]);
  assert.equal(m.params['/search?q'].length.mean, 2);
  assert.equal(m.params['/help?q'].length.mean, 18);
});

test('trainStatModel: keeps class counts per pair and pooled', () => {
  assert.equal(model.params['/search?q'].classCounts.lower, 12);
  assert.equal(model.classCounts.lower, 12);
  assert.equal(model.classCounts.special, 0);
});

test('pToScore: s = -log10(p), 0 for p >= 1, finite for p = 0', () => {
  assert.equal(pToScore(1), 0);
  assert.equal(pToScore(2), 0);
  assert.ok(Math.abs(pToScore(0.01) - 2) < 1e-12);
  assert.ok(Math.abs(pToScore(0.001) - 3) < 1e-12);
  assert.ok(Number.isFinite(pToScore(0)));
});

test('lengthScore: Chebyshev known answer, z = 10 → p ≤ 1/100 → score 2', () => {
  const r = lengthScore(model, get('/search', { q: 'x'.repeat(14) })); // |14 − 4| / 1 = 10
  assert.equal(r.z, 10);
  assert.equal(r.param, 'q');
  assert.ok(Math.abs(r.score - 2) < 1e-12);
  assert.equal(lengthScore(model, get('/search', { q: 'abcd' })).score, 0); // z = 0
});

test('lengthScore: monotonic — a larger deviation never scores lower', () => {
  let previous = -1;
  for (let len = 4; len <= 400; len += 4) {
    const s = lengthScore(model, get('/search', { q: 'x'.repeat(len) })).score;
    assert.ok(s >= previous, `length ${len}`);
    previous = s;
  }
});

test('lengthZScore: an unseen (path, parameter) pair is skipped for now (policy: C-04)', () => {
  assert.deepEqual(lengthZScore(model, get('/other', { q: 'x'.repeat(500) })), {
    z: 0,
    param: null,
  });
});

test('scoreRequest: the score is the max part and names it; labels are never read', () => {
  const request = get('/search', { q: 'x'.repeat(14) });
  const r = scoreRequest(model, request);
  assert.equal(r.top, 'length');
  assert.equal(r.score, Math.max(...Object.values(r.parts)));
  const withLabel = scoreRequest(model, { ...request, label: 'attack', kind: 'sqli' });
  assert.deepEqual(withLabel, r);
});
