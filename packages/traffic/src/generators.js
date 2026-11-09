// Generators for simulated requests. Legitimate traffic is built from innocuous word pools;
// malicious traffic uses a few canonical, public example strings as MEASUREMENT SUBJECTS only —
// they are never executed, parsed, or sent anywhere (ADR-001). Extend both pools in A-02/A-03/A-04.
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

const WORDS = [
  'red',
  'blue',
  'green',
  'shoes',
  'hat',
  'coat',
  'socks',
  'jacket',
  'warm',
  'cotton',
  'summer',
  'winter',
  'sale',
  'new',
];
const NAMES = ['mario', 'giulia', 'alex', 'sam', 'lea', 'noa', "o'brien", 'müller'];
const PATHS = ['/search', '/login', '/products', '/cart', '/profile', '/comments'];

/**
 * A legitimate request: a realistic search / login / pagination / form submission.
 * @param {Rng} rng
 * @returns {{ request: AgRequest, label: 'legit', kind: string, variant: 'typical' }}
 */
export function makeLegitRequest(rng) {
  const kind = rng.pick(['search', 'login', 'pagination', 'form']);
  /** @type {AgRequest} */
  let request;
  switch (kind) {
    case 'login':
      request = {
        method: 'POST',
        path: '/login',
        params: { user: rng.pick(NAMES), pass: 'pw' + rng.int(1000, 999999) },
      };
      break;
    case 'pagination':
      request = { method: 'GET', path: rng.pick(PATHS), params: { page: String(rng.int(1, 50)) } };
      break;
    case 'form': {
      const words = Array.from({ length: rng.int(2, 12) }, () => rng.pick(WORDS)).join(' ');
      request = {
        method: 'POST',
        path: '/comments',
        params: { name: rng.pick(NAMES), body: words },
      };
      break;
    }
    case 'search':
    default: {
      const q = Array.from({ length: rng.int(1, 4) }, () => rng.pick(WORDS)).join(' ');
      request = { method: 'GET', path: '/search', params: { q } };
    }
  }
  return { request, label: 'legit', kind, variant: 'typical' };
}

/**
 * Public example payloads per attack family, used only as detector input (ADR-001). `variant`
 * follows ADR-006: 'canonical' = textbook form of a family the rule set targets; 'obfuscated' =
 * a targeted family transformed to dodge signatures; 'novel' = a family the rule set has no
 * signature for, by design. Keep these as plain data; A-03/A-04 extend the table.
 * @type {Record<string, { payload: string, variant: AttackVariant }[]>}
 */
export const ATTACK_PAYLOADS = {
  sqli: [
    { variant: 'canonical', payload: "' OR '1'='1" },
    { variant: 'canonical', payload: "1' OR '1'='1' --" },
    { variant: 'canonical', payload: "'; DROP TABLE users --" },
    { variant: 'canonical', payload: 'UNION SELECT NULL,NULL' },
  ],
  xss: [
    { variant: 'canonical', payload: '<script>alert(1)</script>' },
    { variant: 'canonical', payload: '"><img src=x onerror=alert(1)>' },
    { variant: 'obfuscated', payload: '%3Cscript%3Ealert(1)%3C/script%3E' }, // double-encoded
  ],
  traversal: [
    { variant: 'canonical', payload: '../../etc/passwd' },
    { variant: 'canonical', payload: '..\\..\\windows\\win.ini' },
    { variant: 'obfuscated', payload: '%2e%2e%2f%2e%2e%2fetc/passwd' }, // double-encoded
  ],
  cmdi: [
    { variant: 'canonical', payload: '; cat /etc/passwd' },
    { variant: 'canonical', payload: '| whoami' },
    { variant: 'canonical', payload: '`id`' },
  ],
  // No rule targets this family on purpose: a long repetitive filler (buffer-overflow / fuzzing
  // style) that only the statistics can see.
  oversized: [{ variant: 'novel', payload: 'A'.repeat(1024) }],
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
