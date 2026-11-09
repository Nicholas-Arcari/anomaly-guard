import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleEngine } from '../src/index.js';

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
