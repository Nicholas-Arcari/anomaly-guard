import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, pOf, percent } from '../src/shell.js';
import { DEFAULTS } from '../src/state.js';

test('pOf: the tail probability of a threshold, p = 10^−threshold, written plainly', () => {
  assert.equal(pOf(0), '1');
  assert.equal(pOf(1), '0.1');
  assert.equal(pOf(2), '0.01');
  assert.equal(pOf(1.5), '0.032');
  assert.equal(pOf(3.999), '0.0001');
  assert.equal(pOf(4), '0.0001');
  assert.equal(pOf(4.001), '1·10^−4');
  assert.equal(pOf(6), '1·10^−6');
});

test('describe: names the seed, the size, the attack share and when an alert fires', () => {
  assert.equal(
    describe(DEFAULTS),
    'Simulated traffic · seed 42 · 1,000 test requests, 10% attacks · alert on a rule match or ' +
      'above the threshold for 1% false positives',
  );
  assert.match(describe({ ...DEFAULTS, mode: 'rules' }), /rules only, alert on a rule match$/);
  assert.match(
    describe({ ...DEFAULTS, mode: 'stats', fpr: 0.005 }),
    /statistics only, alert above the threshold for 0\.5% false positives$/,
  );
  assert.match(
    describe({ ...DEFAULTS, mode: 'stats', fpr: 'manual', threshold: 2 }),
    /statistics only, alert when p ≤ 0\.01$/,
  );
});

test('percent: short percentages for the targets', () => {
  assert.deepEqual([0.05, 0.02, 0.01, 0.005].map(percent), ['5%', '2%', '1%', '0.5%']);
});
