import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleEngine, trainStatModel, detect } from '../src/index.js';

const get = (path, params) => ({ method: 'GET', path, params });

const engine = new RuleEngine();
const model = trainStatModel(
  ['red shoes', 'blue hat', 'green coat', 'socks', 'a nice warm jacket'].map((q) =>
    get('/search', { q }),
  ),
);

const samples = [
  get('/search', { q: 'red hat' }), // ordinary
  get('/search', { q: 'x'.repeat(800) }), // only the statistics can see this
  get('/search', { q: "' OR '1'='1" }), // a rule matches
  get('/search', { q: 'warm cotton socks' }),
];

test('detect (stats): a very long parameter is flagged by the statistical score', () => {
  const res = detect(samples[1], { model, threshold: 1, mode: 'stats' });
  assert.equal(res.verdict, 'attack');
  assert.ok(res.score >= 1);
  assert.match(res.reasons.join(), /length/);
});

test('detect (combined): a rule hit scores +Infinity, so every threshold flags it', () => {
  const res = detect(samples[2], { ruleEngine: engine, model, threshold: 1e9, mode: 'combined' });
  assert.equal(res.score, Infinity);
  assert.equal(res.verdict, 'attack');
  assert.ok(res.ruleMatched);
});

test('detect (rules): binary score, threshold not needed', () => {
  assert.equal(detect(samples[2], { ruleEngine: engine, mode: 'rules' }).score, 1);
  assert.equal(detect(samples[0], { ruleEngine: engine, mode: 'rules' }).score, 0);
});

test('detect: in stats and combined mode, verdict is attack exactly when score ≥ threshold', () => {
  for (const mode of ['stats', 'combined']) {
    for (const threshold of [0, 0.5, 1, 2, 5]) {
      for (const request of samples) {
        const r = detect(request, { ruleEngine: engine, model, threshold, mode });
        assert.equal(r.verdict === 'attack', r.score >= threshold, `${mode} t=${threshold}`);
      }
    }
  }
});

test('detect: refuses to run without what the mode needs (no silent defaults)', () => {
  assert.throws(() => detect(samples[0], { ruleEngine: engine, model, mode: 'combined' }));
  assert.throws(() => detect(samples[0], { model, threshold: 1, mode: 'combined' }));
  assert.throws(() => detect(samples[0], { ruleEngine: engine, threshold: 1, mode: 'stats' }));
  assert.throws(() => detect(samples[0], { ruleEngine: engine, model, threshold: 1, mode: 'x' }));
});
