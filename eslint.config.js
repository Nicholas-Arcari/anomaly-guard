// Minimal flat config (ESLint 9), intentionally dependency-free so `npm install`
// stays light. Tighten it (add @eslint/js, globals, browser/node envs) when the
// team wants stricter gates. Not wired into CI by design — see
// docs/development/adr/ADR-005-no-ci-cd.md.

// These packages run unchanged in the browser (GitHub Pages) AND in Node (server, tests), so they
// must not touch runtime-specific APIs (ADR-003) or unseeded randomness (standards §2.2).
const PURE_SOURCES = [
  'packages/core/src/**/*.js',
  'packages/traffic/src/**/*.js',
  'packages/evaluation/src/**/*.js',
];
const BROWSER_ONLY = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage'];
const NETWORK = ['fetch', 'XMLHttpRequest', 'WebSocket'];
const NODE_ONLY = ['process', 'require', 'module', '__dirname', '__filename', 'Buffer', 'global'];
const NETWORK_MODULES = ['http', 'https', 'net', 'tls', 'dgram'].flatMap((m) => [m, `node:${m}`]);
const OFFLINE = { message: 'No request ever leaves the machine (ADR-001).' };
const SEEDED_ONLY = [
  'error',
  {
    object: 'Math',
    property: 'random',
    message: 'Unseeded randomness breaks reproducibility: use the seeded RNG (traffic/rng).',
  },
];

export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-unused-vars': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: 'error',
      // Payloads are data, never code (ADR-001).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: PURE_SOURCES,
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_ONLY.map((name) => ({ name, message: 'Browser-only API (ADR-003).' })),
        ...NETWORK.map((name) => ({ name, ...OFFLINE })),
        ...NODE_ONLY.map((name) => ({ name, message: 'Node-only API (ADR-003).' })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'fs/*',
                'path',
                'os',
                'child_process',
                'http',
                'https',
                'net',
              ],
              message: 'Node-only module (ADR-003).',
            },
            { group: ['express'], message: 'The server is the only Node-only package (ADR-003).' },
          ],
        },
      ],
      'no-restricted-properties': SEEDED_ONLY,
    },
  },
  {
    // The experiment runner is Node-only: it writes results/ (ADR-009). It stays seeded and
    // offline all the same.
    files: ['packages/experiments/src/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK.map((name) => ({ name, ...OFFLINE }))],
      'no-restricted-imports': ['error', { patterns: [{ group: NETWORK_MODULES, ...OFFLINE }] }],
      'no-restricted-properties': SEEDED_ONLY,
    },
  },
];
