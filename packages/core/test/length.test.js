import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainStatModel, lengthZScore, lengthScore } from '../src/index.js';

const get = (path, params) => ({ method: 'GET', path, params });

// Lengths 3, 5, 4 → mean 4, sample std 1: easy known answers.
const model = trainStatModel([
  get('/search', { q: 'abc' }),
  get('/search', { q: 'abcde' }),
  get('/search', { q: 'abcd' }),
]);

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
