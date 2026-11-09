import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, parseState, toQuery, withState } from '../src/state.js';

test('parseState: no query gives the defaults', () => {
  assert.deepEqual(parseState(''), { ...DEFAULTS });
});

test('parseState: reads every setting', () => {
  assert.deepEqual(parseState('?seed=7&mode=stats&threshold=2.5&prevalence=0.2&size=300'), {
    seed: 7,
    mode: 'stats',
    threshold: 2.5,
    prevalence: 0.2,
    size: 300,
  });
});

test('parseState: an invalid value falls back to its own default only', () => {
  const bad = [
    'seed=-1',
    'seed=1.5',
    'seed=abc',
    'seed=4294967296',
    'mode=evil',
    'threshold=-1',
    'threshold=NaN',
    'threshold=1e9',
    'prevalence=2',
    'size=50',
    'size=100.5',
    'seed=',
  ];
  for (const query of bad) {
    assert.deepEqual(parseState(`?${query}`), { ...DEFAULTS }, query);
  }
  assert.deepEqual(parseState('?seed=-1&size=200'), { ...DEFAULTS, size: 200 });
});

test('toQuery / parseState: round trip', () => {
  const state = { seed: 123, mode: 'rules', threshold: 3, prevalence: 0.05, size: 2000 };
  assert.equal(toQuery(state), 'seed=123&mode=rules&threshold=3&prevalence=0.05&size=2000');
  assert.deepEqual(parseState(toQuery(state)), state);
});

test('withState: adds the settings and keeps other parameters and the hash', () => {
  const state = { ...DEFAULTS, seed: 9 };
  assert.equal(
    withState('./events.html', state),
    './events.html?seed=9&mode=combined&threshold=1&prevalence=0.1&size=1000',
  );
  assert.equal(
    withState('./events.html?show=alerts&seed=1#top', state),
    './events.html?show=alerts&seed=9&mode=combined&threshold=1&prevalence=0.1&size=1000#top',
  );
});

test('withState: extra parameters are set or removed, never duplicated', () => {
  const href = withState('./events.html?show=alerts&page=3', DEFAULTS, { page: 4, show: null });
  const q = new URLSearchParams(href.split('?')[1]);
  assert.equal(q.get('page'), '4');
  assert.equal(q.has('show'), false);
  assert.equal(q.getAll('seed').length, 1);
});
