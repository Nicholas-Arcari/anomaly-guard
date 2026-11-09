import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shannonEntropy, charClassCounts, classifyChar, CHAR_CLASSES } from '../src/index.js';

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

test('CHAR_CLASSES: the seven documented classes, in order (ADR-008)', () => {
  assert.deepEqual(
    [...CHAR_CLASSES],
    ['lower', 'upper', 'digit', 'space', 'special', 'punct', 'nonascii'],
  );
});

test('charClassCounts: one character of each class', () => {
  const c = charClassCounts("aA1 '.é"); // lower, upper, digit, space, special, punct, nonascii
  for (const cls of CHAR_CLASSES) assert.equal(c[cls], 1, cls);
});

test('classifyChar: injection metacharacters and control characters are special', () => {
  for (const ch of ["'", '"', ';', '<', '>', '=', '-', '/', '\\', '%', '|', '$', '`', '*', '#']) {
    assert.equal(classifyChar(ch), 'special', JSON.stringify(ch));
  }
  for (const ch of ['\r', '\n', '\t', '\0', '\x7f']) {
    assert.equal(classifyChar(ch), 'special', JSON.stringify(ch));
  }
});

test('classifyChar: harmless ASCII punctuation is punct, not special', () => {
  for (const ch of ['!', '+', ',', '.', ':', '?', '@', '[', ']', '^', '_', '~']) {
    assert.equal(classifyChar(ch), 'punct', JSON.stringify(ch));
  }
});

test('classifyChar: non-Latin letters are nonascii, never special', () => {
  for (const ch of ['è', 'ü', 'ñ', 'Ω', 'ж', '中', '😀']) {
    assert.equal(classifyChar(ch), 'nonascii', ch);
  }
});
