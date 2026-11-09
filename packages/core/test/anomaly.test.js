import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainStatModel, scoreRequest } from '../src/index.js';

const get = (path, params) => ({ method: 'GET', path, params });

// Lengths 3, 5, 4 → mean 4, sample std 1.
const model = trainStatModel([
  get('/search', { q: 'abc' }),
  get('/search', { q: 'abcde' }),
  get('/search', { q: 'abcd' }),
]);

test('scoreRequest: the score is the max part and names it; labels are never read', () => {
  const request = get('/search', { q: 'x'.repeat(14) });
  const r = scoreRequest(model, request);
  assert.equal(r.top, 'length');
  assert.equal(r.score, Math.max(...Object.values(r.parts)));
  const withLabel = scoreRequest(model, { ...request, label: 'attack', kind: 'sqli' });
  assert.deepEqual(withLabel, r);
});
