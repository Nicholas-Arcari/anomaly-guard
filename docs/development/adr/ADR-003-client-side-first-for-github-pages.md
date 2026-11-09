# ADR-003: Client-side-first so the demo runs on GitHub Pages

**Date:** 2026-10-19
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

The dashboard is to be published on GitHub Pages, which serves **static files only** — no Node
process runs there. But the brief's "client-server" flavour and the realistic ingest loop want a
server too. We need both without forking the detection logic.

## Decision

The detection pipeline runs **fully client-side**. `packages/core`, `packages/traffic` and
`packages/evaluation` are pure JS with **no Node-only and no DOM-only APIs**, so the dashboard
can, in the browser: generate traffic, extract features, run the rules and the statistical model,
and compute the evaluation — entirely on GitHub Pages, with no backend.

`packages/server` (Express) is an **optional local enhancement**: the same `core`, wrapped in an
HTTP `POST /ingest` endpoint, to demonstrate the realistic client→server→verdict loop on
`localhost`. The dashboard may call it when present, but must work without it.

Vite builds the dashboard with `base: './'` so the static bundle works at any Pages path.

## Alternatives considered

| Alternative                            | Why rejected                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Server-rendered app needing a backend  | Cannot run on GitHub Pages; would need separate hosting                              |
| Two implementations (browser + server) | Duplication and drift; the whole reason for the pure `core` is to avoid this         |
| A hosted backend (Render/Fly/etc.)     | Extra accounts/ops for a coursework demo; not needed when `core` runs in the browser |

## Consequences

### Positive

- The public demo is a single static build on Pages, no infrastructure.
- The same code is exercised by the browser, the server, and `node:test`.

### Negative / risks

- `core` must stay runtime-agnostic; a stray `fetch`/`fs`/`window` import breaks either the Pages
  demo or the tests. Enforced by the standards and by the fact that tests run under Node.
- Large experiments in the browser are limited by the tab's memory; big runs use Node scripts and
  write to `results/`.

### Actions

- [x] Keep `core`/`traffic`/`evaluation` free of runtime APIs (standards §2.2).
- [x] Document the manual Pages publish (`npm run build` → push `dist/` to `gh-pages`): see
      `packages/dashboard/README.md`. `dist/` is git-ignored, so it is pushed from a throwaway
      repository inside `dist/`, not with `git subtree`.
- Note: GitHub Pages needs a **public** repository on GitHub Free (a private one needs GitHub Pro,
  free with the Student Developer Pack). The published site is public either way.
