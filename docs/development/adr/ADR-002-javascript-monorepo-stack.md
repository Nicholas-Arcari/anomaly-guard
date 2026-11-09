# ADR-002: JavaScript + npm workspaces monorepo

**Date:** 2026-10-19
**Status:** Accepted — ownership amended: the work is split by statistical theme, not by
workspace ([backlog](../../planning/backlog.md) §8), so "one workspace per member" below no longer
holds
**Author:** The Anomaly Guard team

## Context

The demo has to be shown on a GitHub-hosted (GitHub Pages) website, so the UI must be a static
web build and the detection pipeline must be able to run in the browser. The brief also wants a
"realistic" client-server flavour, so there is a server too. The team wants one language across
frontend and backend, and the detection + evaluation logic shared by the browser demo, the
server, and the tests without duplication.

## Decision

- **JavaScript (ES modules)** everywhere; Node.js ≥ 22 LTS; `"type": "module"`.
- **npm workspaces** monorepo under `packages/*`: `core`, `traffic`, `evaluation`, `server`,
  `dashboard`. Each workspace maps to one group member (`project-structure.md` §2).
- Types via **JSDoc**, no TypeScript compile step.
- Tests with the built-in **`node:test`** runner.
- Lint/format with **ESLint + Prettier**, run locally (not in CI — see ADR-005).

## Alternatives considered

| Alternative                     | Why rejected                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                      | Stronger typing, but adds a build step and config for a small coursework repo; the user chose plain JS. JSDoc covers the public surface. Revisit with an ADR if the codebase grows |
| Python (Flask + scipy)          | Easiest for the statistics, but cannot run the pipeline in the browser for the Pages demo, and splits the stack across two languages                                               |
| Node + separate Python notebook | Two runtimes to maintain; the shared engine could not be reused in the browser                                                                                                     |
| Jest / Vitest                   | More features, but `node:test` is zero-config and enough for library logic; Vite handles the dashboard                                                                             |
| pnpm / Lerna / Turborepo        | Overkill for five small packages; npm workspaces ships with the toolchain                                                                                                          |

## Consequences

### Positive

- One language, one shared `core`, reused by browser demo, server, and tests.
- Clear per-person ownership via workspaces → documentable individual contributions.
- Minimal tooling and install footprint.

### Negative / risks

- Implementing the statistics in JS by hand is more work than `scipy`; this is intentional (the
  methods are the learning objective) and documented in `methods.md`.
- JSDoc is weaker than TypeScript; mitigated by tests and small modules.

### Actions

- [x] Root `package.json` with workspaces and shared scripts.
- [x] One `package.json` per workspace.
