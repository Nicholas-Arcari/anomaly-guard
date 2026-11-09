import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Multi-page app (ADR-010): every section is its own HTML document with its own URL, so GitHub
// Pages serves each one as a real file (no client-side router, no 404 on reload) and a portfolio
// can link or embed any single page. `base: './'` keeps every path relative, so the same build
// works at https://<user>.github.io/anomaly-guard/ and in `vite preview` (ADR-003).

const root = dirname(fileURLToPath(import.meta.url));
const partialsDir = resolve(root, 'partials');

// The pages, in sidebar order. A new page needs its HTML file here and a link in partials/sidebar.html.
const PAGES = ['index', 'events', 'rules', 'models', 'evaluation', 'base-rate', 'about'];

// `<!-- include: partials/header.html -->` → that file's contents, in dev and in the build, so the
// shared header, settings bar, sidebar and footer are written once and every page stays plain HTML.
const INCLUDE = /<!--\s*include:\s*([\w./-]+)\s*-->/g;

function partials() {
  return {
    name: 'anomaly-guard-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(INCLUDE, (_, file) => {
          const path = resolve(root, file);
          if (!path.startsWith(partialsDir + sep)) {
            throw new Error(`partials: ${file} is not inside partials/`);
          }
          return readFileSync(path, 'utf8');
        });
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir + sep)) server.ws.send({ type: 'full-reload' });
    },
  };
}

// Content Security Policy, as a <meta> because GitHub Pages cannot set HTTP headers. Build only:
// the dev server injects scripts and opens a websocket that this policy would block.
// `script-src 'self'` with no exceptions: even if a payload ever reached the page as HTML, it
// could not run (ADR-001). No inline styles either: styles come from the stylesheet, and the few
// computed from JS go through the CSSOM, which CSP allows. `frame-ancestors` cannot be set from a
// <meta>, so any site can embed the demo — which is what the portfolios need.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const CHARSET = '<meta charset="utf-8" />';

function cspMeta() {
  return {
    name: 'anomaly-guard-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // Without the anchor the build must fail: publishing a page without its policy is worse
      // than not publishing it.
      if (!html.includes(CHARSET)) throw new Error(`csp: ${CHARSET} not found`);
      return html.replace(
        CHARSET,
        `${CHARSET}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [partials(), cspMeta()],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((page) => [page, resolve(root, `${page}.html`)])),
    },
  },
});
