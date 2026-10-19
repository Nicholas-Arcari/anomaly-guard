import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shannonEntropy,
  charClassCounts,
  extractFeatures,
  RuleEngine,
  trainStatModel,
  detect,
} from '../src/index.js';

test('shannonEntropy: empty string is 0', () => {
  assert.equal(shannonEntropy(''), 0);
});

test('shannonEntropy: a single repeated symbol is 0', () => {
  assert.equal(shannonEntropy('aaaaaa'), 0);
});

test('shannonEntropy: two equally frequent symbols is 1 bit', () => {
  assert.equal(shannonEntropy('0101'), 1);
});

test('shannonEntropy: k equally frequent symbols is log2(k)', () => {
  // 4 distinct symbols, each once → log2(4) = 2 bits
  assert.ok(Math.abs(shannonEntropy('abcd') - 2) < 1e-12);
});

test('charClassCounts: classifies lower/upper/digit/space/special/other', () => {
  const c = charClassCounts("aA1 '"); // lower, upper, digit, space, special
  assert.equal(c.lower, 1);
  assert.equal(c.upper, 1);
  assert.equal(c.digit, 1);
  assert.equal(c.space, 1);
  assert.equal(c.special, 1);
  assert.equal(c.other, 0);
});

test('extractFeatures: aggregates length, entropy and encoding flag', () => {
  const f = extractFeatures({ method: 'get', path: '/search', params: { q: 'red shoes' } });
  assert.equal(f.method, 'GET');
  assert.equal(f.paramCount, 1);
  assert.equal(f.totalLength, 'red shoes'.length);
  assert.equal(f.maxParamLength, 'red shoes'.length);
  assert.equal(f.hasEncoding, false);

  const enc = extractFeatures({ method: 'GET', path: '/x', params: { q: '%3Cscript%3E' } });
  assert.equal(enc.hasEncoding, true);
});

test('RuleEngine: flags an obvious SQL injection and reports the rule', () => {
  const engine = new RuleEngine();
  const r = engine.inspect({ method: 'GET', path: '/login', params: { u: "' OR '1'='1" } });
  assert.equal(r.matched, true);
  assert.ok(r.hits.some((h) => h.kind === 'sqli'));
});

test('RuleEngine: leaves normal input alone', () => {
  const engine = new RuleEngine();
  const r = engine.inspect({ method: 'GET', path: '/search', params: { q: 'red shoes' } });
  assert.equal(r.matched, false);
});

test('trainStatModel: learns per-parameter length stats from normal traffic', () => {
  const normal = [
    { method: 'GET', path: '/search', params: { q: 'abc' } }, // len 3
    { method: 'GET', path: '/search', params: { q: 'abcde' } }, // len 5
    { method: 'GET', path: '/search', params: { q: 'abcd' } }, // len 4
  ];
  const model = trainStatModel(normal);
  assert.equal(model.trainedOn, 3);
  assert.equal(model.lengthByParam.q.mean, 4);
  assert.ok(model.lengthByParam.q.std > 0);
});

test('detect (combined): a very long parameter is flagged by the statistical score', () => {
  const normal = Array.from({ length: 30 }, () => ({
    method: 'GET',
    path: '/search',
    params: { q: 'red shoes' }, // length 9
  }));
  const model = trainStatModel(normal);
  const engine = new RuleEngine();

  // std is 0 here (all equal), so add a little spread to make a z-score meaningful.
  const spread = ['red shoes', 'blue hat', 'green coat', 'socks', 'a nice warm jacket'];
  const model2 = trainStatModel(
    spread.map((q) => ({ method: 'GET', path: '/search', params: { q } })),
  );

  const long = { method: 'GET', path: '/search', params: { q: 'x'.repeat(800) } };
  const res = detect(long, { ruleEngine: engine, model: model2, threshold: 3, mode: 'stats' });
  assert.equal(res.verdict, 'attack');
  assert.ok(res.score >= 3);

  // sanity: the model trained above is usable
  assert.equal(model.trainedOn, 30);
});
