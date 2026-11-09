import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, severityOf, SIGNATURE_LEVEL, MAX_STAT_LEVEL } from '../src/levels.js';

test('levelOf: a signature match is level 15 whatever the statistical score', () => {
  assert.equal(levelOf({ ruleMatched: true, statScore: 0 }), SIGNATURE_LEVEL);
  assert.equal(levelOf({ ruleMatched: true, statScore: 3.7 }), SIGNATURE_LEVEL);
});

test('levelOf: level k means s = −log10(p) ≥ k, capped below the signature level', () => {
  const at = (statScore) => levelOf({ ruleMatched: false, statScore });
  assert.equal(at(0), 0);
  assert.equal(at(Number.NaN), 0);
  assert.equal(at(0.99), 0);
  assert.equal(at(1), 1);
  assert.equal(at(1.99), 1);
  assert.equal(at(2), 2);
  assert.equal(at(100), MAX_STAT_LEVEL);
  assert.equal(at(Infinity), MAX_STAT_LEVEL);
});

test('severityOf: low 0–1, medium 2–3, high 4–14, critical 15', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 14, 15].map(severityOf), [
    'low',
    'low',
    'medium',
    'medium',
    'high',
    'high',
    'critical',
  ]);
});
