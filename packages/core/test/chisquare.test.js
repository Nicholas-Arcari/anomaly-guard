import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainStatModel, chiSquareScore } from '../src/index.js';
import { chiSquare6LogSurvival } from '../src/stats/chisquare.js';

const get = (path, params) => ({ method: 'GET', path, params });

// One character of each class: with Laplace smoothing each p̂_i = (1 + 1) / (7 + 7) = 1/7, so
// the expected shares are uniform and the chi-square has simple exact values.
const ONE_OF_EACH = "aA1 '!é";
const uniform = trainStatModel([get('/search', { q: ONE_OF_EACH })]);

test('chiSquare6LogSurvival: known answers p ≈ 0.05 and p ≈ 0.01 for df = 6', () => {
  const p05 = Math.exp(chiSquare6LogSurvival(12.592));
  const p01 = Math.exp(chiSquare6LogSurvival(16.812));
  assert.ok(Math.abs(p05 - 0.05) < 1e-4, `p(12.592) = ${p05}`);
  assert.ok(Math.abs(p01 - 0.01) < 1e-5, `p(16.812) = ${p01}`);

  // s = −log10(p): the 5% and 1% critical values are scores ≈ 1.301 and 2.
  assert.ok(Math.abs(-chiSquare6LogSurvival(12.592) / Math.LN10 - 1.301) < 1e-3);
  assert.ok(Math.abs(-chiSquare6LogSurvival(16.812) / Math.LN10 - 2) < 1e-4);
});

test('chiSquare6LogSurvival: x = 0 gives p = 1 and the score is monotone in χ²', () => {
  assert.equal(chiSquare6LogSurvival(0), 0);
  assert.equal(Math.exp(chiSquare6LogSurvival(0)), 1);

  let previous = -Infinity;
  for (let x = 0; x <= 100; x += 0.25) {
    const score = -chiSquare6LogSurvival(x) / Math.LN10;
    assert.ok(score >= previous, `χ² = ${x}`);
    previous = score;
  }
});

test('chiSquare6LogSurvival: a huge χ² keeps a finite score when p underflows to 0', () => {
  const logP = chiSquare6LogSurvival(1e6);
  assert.ok(Number.isFinite(logP));
  assert.equal(Math.exp(logP), 0); // the p-value underflows...
  assert.ok(Number.isFinite(-logP / Math.LN10)); // ...the score does not
  assert.ok(-logP / Math.LN10 > 200000);
  assert.ok(Number.isFinite(chiSquare6LogSurvival(1e300)));
});

test('chiSquareScore: Laplace-smoothed exact answer χ² = 6N = 24 for N = 4', () => {
  const r = chiSquareScore(uniform, get('/search', { q: 'aaaa' }));
  assert.equal(r.param, 'q');
  assert.equal(r.df, 6);
  assert.ok(Math.abs(r.chiSquare - 24) < 1e-12, `χ² = ${r.chiSquare}`);
  // Survival at χ² = 24, df = 6: p = e^−12 · 85, s = 3.2821…
  assert.ok(Math.abs(r.pValue - 0.0005222580500328979) < 1e-15);
  assert.ok(Math.abs(r.score - 3.282114857124729) < 1e-12);
});

test('chiSquareScore: a value matching the learned distribution scores 0 (χ² = 0, p = 1)', () => {
  const r = chiSquareScore(uniform, get('/search', { q: ONE_OF_EACH }));
  assert.equal(r.chiSquare, 0);
  assert.equal(r.pValue, 1);
  assert.equal(r.score, 0);
  assert.equal(r.param, 'q');
});

test('chiSquareScore: unseen pair uses the pooled counts (ADR-007)', () => {
  const r = chiSquareScore(uniform, get('/other', { q: 'aaaa' }));
  assert.equal(r.param, 'q');
  assert.ok(Math.abs(r.chiSquare - 24) < 1e-12);
});

test('chiSquareScore: no training data still gives Laplace-smoothed uniform expectations', () => {
  const empty = trainStatModel([]);
  const r = chiSquareScore(empty, get('/search', { q: 'aaaa' }));
  assert.ok(Math.abs(r.chiSquare - 24) < 1e-12);
  assert.ok(Number.isFinite(r.score));
});

test('chiSquareScore: reports the worst parameter; ties keep the first; empty values are skipped', () => {
  const both = trainStatModel([get('/search', { q: ONE_OF_EACH, page: ONE_OF_EACH })]);

  const worst = chiSquareScore(both, get('/search', { q: ONE_OF_EACH, page: 'aaaa' }));
  assert.equal(worst.param, 'page');
  assert.ok(Math.abs(worst.chiSquare - 24) < 1e-12);

  const tie = chiSquareScore(both, get('/search', { q: 'aaaa', page: 'bbbb' }));
  assert.equal(tie.param, 'q');
  assert.ok(Math.abs(tie.chiSquare - 24) < 1e-12);

  const skipped = chiSquareScore(both, get('/search', { q: '', page: 'aaaa' }));
  assert.equal(skipped.param, 'page');
});

test('chiSquareScore: no usable parameter returns the neutral result', () => {
  const neutral = { chiSquare: 0, df: 6, pValue: 1, score: 0, param: null };
  assert.deepEqual(chiSquareScore(uniform, get('/search', {})), neutral);
  assert.deepEqual(chiSquareScore(uniform, get('/search', { q: '' })), neutral);
});

test('chiSquareScore: monotonic — more deviating characters never score lower', () => {
  let previous = -1;
  for (let n = 0; n <= 64; n += 1) {
    const r = chiSquareScore(uniform, get('/search', { q: 'a'.repeat(n) }));
    assert.ok(r.score >= previous, `N = ${n}`);
    previous = r.score;
  }
});
