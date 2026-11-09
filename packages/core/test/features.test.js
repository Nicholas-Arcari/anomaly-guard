import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, paramFeatures, CHAR_CLASSES } from '../src/index.js';

test('extractFeatures: aggregates length, entropy and encoding flag', () => {
  const f = extractFeatures({ method: 'get', path: '/search', params: { q: 'red shoes' } });
  assert.equal(f.method, 'GET');
  assert.equal(f.paramCount, 1);
  assert.equal(f.totalLength, 'red shoes'.length);
  assert.equal(f.maxParamLength, 'red shoes'.length);
  assert.equal(f.hasEncoding, false);

  // Values are already decoded once (ADR-006): leftover %xx means double encoding.
  const enc = extractFeatures({ method: 'GET', path: '/x', params: { q: '%3Cscript%3E' } });
  assert.equal(enc.hasEncoding, true);
});

test('paramFeatures: class counts are the observed counts and sum to the length', () => {
  const p = paramFeatures('name', "O'Brien 2");
  const total = CHAR_CLASSES.reduce((sum, cls) => sum + p.classCounts[cls], 0);
  assert.equal(total, p.length);
  assert.equal(p.classCounts.special, 1); // the apostrophe
  assert.equal(p.classCounts.upper, 2);
});
