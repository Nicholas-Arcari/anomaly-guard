// Generators for simulated requests. Legitimate traffic is built from innocuous word pools;
// malicious traffic uses a few canonical, public example strings as MEASUREMENT SUBJECTS only —
// they are never executed, parsed, or sent anywhere (ADR-001). Extend both pools in A-02/A-03/A-04.
// Pure, runtime-agnostic (takes an Rng so it stays reproducible).

/** @typedef {import('@anomaly-guard/core').AgRequest} AgRequest */
/** @typedef {import('./rng.js').Rng} Rng */

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
 * @returns {{ request: AgRequest, label: 'legit', kind: string }}
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
  return { request, label: 'legit', kind };
}

/**
 * Canonical public example payloads per attack family, used only as detector input.
 * Keep these as plain data. A-03/A-04: expand coverage and add obfuscated/novel variants.
 * @type {Record<string, string[]>}
 */
export const ATTACK_PAYLOADS = {
  sqli: ["' OR '1'='1", "1' OR '1'='1' --", "'; DROP TABLE users --", 'UNION SELECT NULL,NULL'],
  xss: [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    '%3Cscript%3Ealert(1)%3C/script%3E',
  ],
  traversal: ['../../etc/passwd', '..\\..\\windows\\win.ini', '%2e%2e%2f%2e%2e%2fetc/passwd'],
  cmdi: ['; cat /etc/passwd', '| whoami', '`id`'],
  oversized: [], // filled below with a long filler string (buffer-overflow / fuzzing style)
};
ATTACK_PAYLOADS.oversized = ['A'.repeat(1024)];

/**
 * A malicious request: a public example payload of a random family placed in a plausible
 * parameter. The payload is data, never executed (ADR-001).
 * @param {Rng} rng
 * @returns {{ request: AgRequest, label: 'attack', kind: string }}
 */
export function makeAttackRequest(rng) {
  const kind = rng.pick(Object.keys(ATTACK_PAYLOADS).filter((k) => ATTACK_PAYLOADS[k].length));
  const payload = rng.pick(ATTACK_PAYLOADS[kind]);
  const param = rng.pick(['q', 'user', 'id', 'file', 'cmd']);
  const path = rng.pick(PATHS);
  const method = rng.pick(['GET', 'POST']);
  return { request: { method, path, params: { [param]: payload } }, label: 'attack', kind };
}
