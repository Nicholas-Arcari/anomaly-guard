// Generators for simulated requests. Legitimate traffic is built from innocuous word pools;
// malicious traffic uses a few canonical, public example strings as MEASUREMENT SUBJECTS only —
// they are never executed, parsed, or sent anywhere (ADR-001).
// Pure, runtime-agnostic (takes an Rng so it stays reproducible).
//
// Dataset contract (ADR-006):
//   - an attack is a generated LEGITIMATE request with ONE parameter value replaced by a payload:
//     the attacker controls values, not the endpoint's schema (same method, path, parameter names);
//   - every sample carries a `variant` (legit: typical | hard; attack: canonical | obfuscated |
//     novel), assigned by how the sample was made, never by whether a detector catches it;
//   - parameter values are what the application sees after the server's single URL-decoding
//     pass, so a payload that still contains %xx is a double-encoded (obfuscated) one.

/** @typedef {import('@anomaly-guard/core').AgRequest} AgRequest */
/** @typedef {import('./rng.js').Rng} Rng */
/** @typedef {'canonical' | 'obfuscated' | 'novel'} AttackVariant */

import { weightedIndex, geometric, textLength } from './distributions.js';

// Ranked vocabulary: rarer fragments introduce punctuation, numbers and other scripts naturally.
const WORDS = [
  'the',
  'order',
  'is',
  'good',
  'please',
  'new',
  'product',
  'and',
  'delivery',
  'thank',
  'you',
  'blue',
  'cotton',
  'shoes',
  'sale',
  'size',
  'winter',
  'summer',
  'price',
  'today',
  'hello',
  "l'ordine",
  "O'Brien",
  'café',
  '東京',
  'مرحبا',
  '€12.50',
  '2026-11-01',
  'SKU-42',
  'https://example.com/item',
  'great!',
  'really?',
  'note:',
  'yes,',
  'fine.',
];
const WORD_WEIGHTS = WORDS.map((_, i) => 1 / (i + 1));
const NAMES = ['Ari', 'Noa', 'Sam', 'Mika', "O'Brien", 'Élo', '東京', 'مرحبا'];
const EMAIL_PARTS = ['sample1', 'visitor2', 'example3', 'guest4', 'user5'];
const PASSWORD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#-_.?';
const ENDPOINTS = ['search', 'products', 'cart', 'login', 'profile', 'comments'];
const ENDPOINT_WEIGHTS = [25, 20, 15, 15, 10, 15];

function word(rng) {
  return WORDS[weightedIndex(rng, WORD_WEIGHTS)];
}

// The final slice makes the generated UTF-16 length match the sampled length exactly.
function text(rng) {
  const length = textLength(rng);
  let result = '';
  while (result.length < length) {
    const subject = word(rng);
    const detail = word(rng);
    const sentence = rng.pick([
      `Please check ${subject}: ${detail}.`,
      `I liked ${subject}, thank you!`,
      `Is ${subject} available? ${detail}.`,
      `My note about ${subject}: ${detail}.`,
    ]);
    result += (result ? ' ' : '') + sentence;
  }
  return result.slice(0, length);
}

function password(rng) {
  const length = rng.int(8, 24);
  return Array.from({ length }, () => PASSWORD_CHARS[rng.int(0, PASSWORD_CHARS.length - 1)]).join(
    '',
  );
}

/**
 * Generate a request from the synthetic probability model in methods.md §0.
 * @param {Rng} rng
 * @returns {{ request: AgRequest, label: 'legit', kind: string, variant: 'typical' }}
 */
export function makeLegitRequest(rng) {
  const kind = ENDPOINTS[weightedIndex(rng, ENDPOINT_WEIGHTS)];
  /** @type {AgRequest} */
  let request;
  switch (kind) {
    case 'search':
      request = {
        method: 'GET',
        path: '/search',
        params: {
          q: Array.from({ length: rng.int(1, 4) }, () => word(rng)).join(' '),
          page: String(geometric(rng, 0.35)),
        },
      };
      break;
    case 'products':
      request = {
        method: 'GET',
        path: '/products',
        params: {
          id: String(rng.int(1, 9999)),
          sort: rng.pick(['popular', 'price', 'new']),
        },
      };
      break;
    case 'cart':
      request = {
        method: 'POST',
        path: '/cart',
        params: {
          id: String(rng.int(1, 9999)),
          qty: String(geometric(rng, 0.5)),
        },
      };
      break;
    case 'login':
      request = {
        method: 'POST',
        path: '/login',
        params: {
          user: rng.pick(NAMES),
          pass: password(rng),
        },
      };
      break;
    case 'profile':
      request = {
        method: 'POST',
        path: '/profile',
        params: {
          email: rng.pick(EMAIL_PARTS) + '@example.com',
          bio: text(rng),
        },
      };
      break;
    default:
      request = {
        method: 'POST',
        path: '/comments',
        params: {
          name: rng.pick(NAMES),
          body: text(rng),
        },
      };
  }
  return { request, label: 'legit', kind, variant: 'typical' };
}

/**
 * Public example payloads per attack family, used only as detector input (ADR-001). `variant`
 * follows ADR-006: 'canonical' = textbook form of a family the rule set targets; 'obfuscated' =
 * a targeted family transformed to dodge signatures; 'novel' = a family the rule set has no
 * signature for, by design. Keep these as plain data; public sources are listed in methods.md §0.
 * @type {Record<string, { payload: string, variant: AttackVariant }[]>}
 */
export const ATTACK_PAYLOADS = {
  sqli: [
    { variant: 'canonical', payload: "' OR '1'='1" },
    { variant: 'canonical', payload: "1' OR '1'='1' --" },
    { variant: 'canonical', payload: "'; DROP TABLE users --" },
    { variant: 'canonical', payload: 'UNION SELECT NULL,NULL' },
    { variant: 'canonical', payload: '10 OR 1=1' },
    { variant: 'canonical', payload: '10 UNION SELECT 1,null,null--' },
    // Short mimicry examples retain the canonical label: it describes their construction.
    { variant: 'canonical', payload: '1 OR 1=1' },
    { variant: 'canonical', payload: "admin'--" },
    { variant: 'obfuscated', payload: 'UN/**/ION SELECT NULL,NULL' },
    { variant: 'obfuscated', payload: 'uNiOn SeLeCt NULL,NULL' },
    { variant: 'obfuscated', payload: 'UNION\tSELECT NULL,NULL' },
    { variant: 'obfuscated', payload: 'UNION\nSELECT NULL,NULL' },
  ],
  xss: [
    { variant: 'canonical', payload: '<script>alert(1)</script>' },
    { variant: 'canonical', payload: '"><img src=x onerror=alert(1)>' },
    { variant: 'canonical', payload: "<body onload=alert('test1')>" },
    { variant: 'canonical', payload: "<b onmouseover=alert('Wufff!')>click me!</b>" },
    { variant: 'canonical', payload: '<script>alert("TEST");</script>' },
    { variant: 'canonical', payload: '<svg/onload=alert(1)>' },
    { variant: 'obfuscated', payload: '%3Cscript%3Ealert(1)%3C/script%3E' }, // double-encoded
    { variant: 'obfuscated', payload: "<script>window['al'+'ert'](1)</script>" },
    { variant: 'obfuscated', payload: '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">' },
  ],
  traversal: [
    { variant: 'canonical', payload: '../../etc/passwd' },
    { variant: 'canonical', payload: '..\\..\\windows\\win.ini' },
    { variant: 'canonical', payload: '../../../../etc/shadow' },
    { variant: 'canonical', payload: '../../../../some dir/some file' },
    { variant: 'canonical', payload: '../../../../../../../../../etc/passwd' },
    { variant: 'canonical', payload: '..\\..\\..\\windows\\win.ini' },
    { variant: 'obfuscated', payload: '%2e%2e%2f%2e%2e%2fetc/passwd' }, // double-encoded
  ],
  cmdi: [
    { variant: 'canonical', payload: '; cat /etc/passwd' },
    { variant: 'canonical', payload: '| whoami' },
    { variant: 'canonical', payload: '`id`' },
    { variant: 'canonical', payload: '&& whoami' },
    { variant: 'canonical', payload: '|| whoami' },
    { variant: 'canonical', payload: '& whoami' },
  ],
  // No rule targets this family on purpose: a long repetitive filler (buffer-overflow / fuzzing
  // style) that only the statistics can see.
  oversized: [{ variant: 'novel', payload: 'A'.repeat(1024) }],
  // The novel family list is fixed before evaluation, not selected by rule-engine results.
  template: [{ variant: 'novel', payload: '{{7*7}}' }],
  ldap: [{ variant: 'novel', payload: '*)(uid=*))(|(uid=*' }],
  nosql: [{ variant: 'novel', payload: '{"$ne":null}' }],
  crlf: [{ variant: 'novel', payload: '\r\nX-Injected: test' }],
};

/**
 * A malicious request: a generated legitimate request with ONE parameter value replaced by a
 * public example payload (ADR-006). The payload is data, never executed (ADR-001).
 * @param {Rng} rng
 * @returns {{ request: AgRequest, label: 'attack', kind: string, variant: AttackVariant }}
 */
export function makeAttackRequest(rng) {
  const { request: base } = makeLegitRequest(rng);
  const kind = rng.pick(Object.keys(ATTACK_PAYLOADS).filter((k) => ATTACK_PAYLOADS[k].length));
  const { payload, variant } = rng.pick(ATTACK_PAYLOADS[kind]);
  const param = rng.pick(Object.keys(base.params));
  return {
    request: { ...base, params: { ...base.params, [param]: payload } },
    label: 'attack',
    kind,
    variant,
  };
}
