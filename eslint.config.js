// Minimal flat config (ESLint 9), intentionally dependency-free so `npm install`
// stays light. Tighten it (add @eslint/js, globals, browser/node envs) when the
// team wants stricter gates. Not wired into CI by design — see
// docs/development/adr/ADR-005-no-ci-cd.md.
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
    },
  },
];
