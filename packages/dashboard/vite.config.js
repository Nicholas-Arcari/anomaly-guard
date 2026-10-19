import { defineConfig } from 'vite';

// `base: './'` makes the static build work at any path, including a GitHub Pages project URL
// like https://<user>.github.io/anomaly-guard/ (ADR-003).
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist' },
});
