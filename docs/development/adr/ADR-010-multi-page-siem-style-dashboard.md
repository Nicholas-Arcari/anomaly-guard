# ADR-010: Dashboard as a multi-page, SIEM-style console

**Date:** 2026-11-09
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

The dashboard is the public face of the project. It is published on GitHub Pages (ADR-003) and
embedded in the team members' portfolios, which are GitHub Pages sites too. The team asked for:

- a **multi-page app (MPA)** rather than a single-page app;
- an interface **in the style of a SIEM console such as Wazuh**;
- a demo that portfolios can show and use **without copying the code**.

Constraints:

- GitHub Pages serves static files and cannot set HTTP headers. A single-page app with a
  client-side router needs a `404.html` workaround for deep links; a multi-page app has one real
  file per page.
- The safe way to embed someone else's page is a sandboxed iframe without `allow-same-origin`. The
  page then runs with an opaque origin: no `localStorage`, `sessionStorage` or cookies, and no form
  submission unless `allow-forms` is granted.
- Payloads are attack strings: they are displayed, never rendered as HTML (ADR-001).

## Decision

1. **One HTML file per section**: `index` (overview), `events`, `rules`, `models`, `evaluation`,
   `base-rate`, `about`, all listed as Vite build inputs. Same stack as before (ADR-002): Vite and
   vanilla JS, no router, no UI framework.
2. **Shared header, settings bar, sidebar and footer as partials** (`partials/*.html`), inserted
   by a small Vite plugin in `vite.config.js` (`<!-- include: partials/x.html -->`) in dev and in
   the build. No templating dependency.
3. **Experiment settings in the URL**: `?seed=42&mode=combined&threshold=1&prevalence=0.1&size=1000`
   (`src/state.js`). Every page rebuilds the same seeded experiment from them (same seed → same
   data); links carry them; nothing uses browser storage. The settings form applies on the Apply
   button's click and navigates from script: in a sandboxed iframe without `allow-forms` the
   browser cancels a form submission before the `submit` event even fires, but clicks and a page's
   navigation of itself still work. Page parameters (`show`, `page` on the events page) are plain
   links too.
4. **SIEM-style interface, original design**: top bar, left navigation, settings bar, KPI tiles,
   severity strip, alert table with expandable details, colour-coded alert levels, light and dark
   themes. It borrows the layout conventions of SIEM consoles such as Wazuh, but uses no Wazuh
   name, logo, asset or code (Wazuh is GPL; this project is MIT).
5. **Alert levels 0–15 with a statistical meaning** (`src/levels.js`). A statistical alert of level
   k has s = −log10(p) ≥ k, i.e. p ≤ 10^−k (ADR-007), capped at 14; level 15 means a signature
   matched. Severities: low 0–1, medium 2–3, high 4–14, critical 15. The levels are for display
   only: the verdict always comes from the threshold.
6. **Content Security Policy** in a `<meta>` injected at build time: `script-src 'self'`,
   `style-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. No inline
   scripts or styles; data reaches the page only as text nodes (`src/dom.js`), never through
   `innerHTML`.
7. **Charts with Chart.js**, already listed in the tech stack. Only the components in use are
   registered (`src/charts.js`).
8. **Theme panels stay placeholders until their task lands**: E-02 (T1, T2, T3), E-03 (T4), E-06
   (T3). Each placeholder names its task and theme.

## Alternatives considered

| Alternative                                   | Why rejected                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Single-page app with a client-side router     | Deep links break on GitHub Pages without a `404.html` workaround; the team asked for a multi-page app |
| Copying the header and sidebar into each page | Seven copies to keep in sync                                                                          |
| Header and sidebar rendered from JavaScript   | Navigation would depend on JavaScript and flicker on load                                             |
| A templating plugin (Handlebars, EJS)         | A new dependency for what a 20-line plugin does                                                       |
| `localStorage` for the settings               | Not available in a sandboxed iframe; a URL is also shareable and reproducible                         |
| Reusing Wazuh's dashboard code or assets      | GPL code and trademarks in an MIT project; only the layout conventions are borrowed                   |

## Consequences

### Positive

- Every page has a stable URL that a portfolio can link or embed, and the URL alone determines
  what the page shows.
- It works in a sandboxed iframe, so a portfolio does not have to trust the demo with its own
  origin.
- An injected script could not run (CSP), on top of payloads being inserted as text only.

### Negative / risks

- Every page recomputes the experiment on load: a few milliseconds at the default size, more at
  the 5,000-request maximum.
- The pages only work through Vite (`npm run dev`, or the build): opened straight from the file
  system, the partials are not expanded.

### Actions

- [x] Pages, partials, settings in the URL, alert levels, CSP; tests for `state`, `levels` and
      `pipeline`.
- [x] Published on GitHub Pages, with a team guide for portfolios (`docs/guides/team-guide.md`).
- [ ] Theme panels: E-02, E-03, E-06.
