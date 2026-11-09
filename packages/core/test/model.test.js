import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainStatModel, paramKey, pToScore } from '../src/index.js';

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
