import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, pOf } from '../src/shell.js';
import { DEFAULTS } from '../src/state.js';

test('pOf: the tail probability of a threshold, p = 10^−threshold, written plainly', () => {
  assert.equal(pOf(0), '1');
  assert.equal(pOf(1), '0.1');
  assert.equal(pOf(2), '0.01');
  assert.equal(pOf(1.5), '0.032');
  assert.equal(pOf(4), '0.0001');
  assert.equal(pOf(6), '1·10^−6');
});

test('describe: names the seed, the size, the attack share and when an alert fires', () => {
  assert.equal(
    describe(DEFAULTS),
    'Simulated traffic · seed 42 · 1,000 test requests, 10% attacks · alert on a rule match or ' +
      'when p ≤ 0.1',
  );
  assert.match(describe({ ...DEFAULTS, mode: 'rules' }), /rules only, alert on a rule match$/);
  assert.match(describe({ ...DEFAULTS, mode: 'stats', threshold: 2 }), /when p ≤ 0\.01$/);
});
