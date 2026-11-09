// Shannon entropy and character-distribution primitives.
// Pure, runtime-agnostic (no DOM, no Node API). See docs/statistics/methods.md §0–§1 and ADR-008.

/**
 * The fixed character classes used for distribution features and the chi-square score
 * (ADR-008, methods.md §0). Keep this stable: changing it silently invalidates trained models and
 * reported results (standards §3). Every character maps to exactly one class.
 * @type {readonly string[]}
 */
export const CHAR_CLASSES = Object.freeze([
  'lower', // a-z
  'upper', // A-Z
  'digit', // 0-9
  'space', // a single space (U+0020)
  'special', // injection metacharacters (SPECIAL_CHARS) and control characters
  'punct', // the remaining printable ASCII punctuation: ! + , . : ? @ [ ] ^ _ ~
  'nonascii', // any code point >= U+0080: accented letters, non-Latin scripts, emoji
]);

/**
 * Metacharacters of SQL, HTML/JS, shell and path syntax: frequent in injection payloads, rare in
 * normal input. Control characters (U+0000–U+001F, U+007F) are classed as `special` too.
 * Documented in methods.md §0.
 * @type {ReadonlySet<string>}
 */
export const SPECIAL_CHARS = new Set([
  "'",
  '"',
  ';',
  '<',
  '>',
  '(',
  ')',
  '=',
  '-',
  '/',
  '\\',
  '%',
  '&',
  '|',
  '$',
  '{',
  '}',
  '`',
  '*',
  '#',
]);

/**
 * Classify a single character (one code point) into one of CHAR_CLASSES.
 * @param {string} ch a single-code-point string
 * @returns {string} one of CHAR_CLASSES
 */
export function classifyChar(ch) {
  if (ch >= 'a' && ch <= 'z') return 'lower';
  if (ch >= 'A' && ch <= 'Z') return 'upper';
  if (ch >= '0' && ch <= '9') return 'digit';
  if (ch === ' ') return 'space';
  const code = ch.codePointAt(0) ?? 0;
  if (SPECIAL_CHARS.has(ch) || code < 0x20 || code === 0x7f) return 'special';
  if (code < 0x80) return 'punct';
  return 'nonascii';
}

/**
 * Count characters per class.
 * @param {string} input
 * @returns {Record<string, number>} counts keyed by CHAR_CLASSES (every class present, may be 0)
 */
export function charClassCounts(input) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const cls of CHAR_CLASSES) counts[cls] = 0;
  for (const ch of String(input)) counts[classifyChar(ch)] += 1;
  return counts;
}

/**
 * Histogram of raw symbols (characters) in a string: symbol -> count. Used for the entropy; the
 * binned histogram that feeds the models is charClassCounts.
 * @param {string} input
 * @returns {Map<string, number>}
 */
export function charHistogram(input) {
  /** @type {Map<string, number>} */
  const hist = new Map();
  for (const ch of String(input)) hist.set(ch, (hist.get(ch) ?? 0) + 1);
  return hist;
}

/**
 * Shannon entropy of a string, in bits per symbol.
 * H = -Σ p_i log2(p_i), with 0 ≤ H ≤ log2(k), k = number of distinct symbols.
 * An empty string has entropy 0 by convention.
 * @param {string} input
 * @returns {number} entropy in bits/symbol
 */
export function shannonEntropy(input) {
  const s = String(input);
  const n = s.length;
  if (n === 0) return 0;
  const hist = charHistogram(s);
  let h = 0;
  for (const count of hist.values()) {
    const p = count / n;
    h -= p * Math.log2(p);
  }
  return h;
}
