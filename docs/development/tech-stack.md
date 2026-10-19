# Tech stack

> This is the **closed list** of allowed technologies. Anything not here needs an ADR before it
> is introduced. Reference decision: [`adr/ADR-002-javascript-monorepo-stack.md`](adr/ADR-002-javascript-monorepo-stack.md).
>
> **Status:** _In use_ = installed and wired. _Decided_ = chosen, not yet installed. _Proposed_ =
> to confirm during build.

## 1. Overview

```
            Browser (GitHub Pages)                 Local dev only
         ┌───────────────────────────┐        ┌────────────────────┐
         │  dashboard (Vite, vanilla)│        │  server (Express)  │
         │  + traffic + evaluation   │        │  + core            │
         │  + core  → runs fully     │        │  POST /ingest      │
         │  client-side              │        │  (localhost)       │
         └─────────────┬─────────────┘        └─────────┬──────────┘
                       └───────────────┬────────────────┘
                                       │
                               @anomaly-guard/core
                        (pure JS — browser and Node)
```

## 2. Runtime & tooling

| Component   | Choice                      | Version  | Status           | Notes                                              |
| ----------- | --------------------------- | -------- | ---------------- | -------------------------------------------------- |
| Language    | JavaScript (ES modules)     | ES2023   | In use           | `"type": "module"`; JSDoc for types, no TS compile |
| Runtime     | Node.js                     | ≥ 22 LTS | In use           | `engines` in root `package.json`                   |
| Monorepo    | npm workspaces              | npm ≥ 10 | In use           | `packages/*`; no Lerna / Turborepo / pnpm          |
| Test runner | `node:test` + `node --test` | built-in | In use           | Zero-config, no Jest / Vitest                      |
| Lint        | ESLint                      | ^9.13    | In use           | Flat config, dependency-free rules for now         |
| Format      | Prettier                    | ^3.3     | In use           | `printWidth: 100`, single quotes                   |
| CI          | —                           | —        | **Out of scope** | No GitHub Actions / Dependabot / CodeQL — ADR-005  |

## 3. `core` — shared engine

| Component            | Choice                                          | Status            | Notes                                              |
| -------------------- | ----------------------------------------------- | ----------------- | -------------------------------------------------- |
| Feature extraction   | hand-written, pure JS                           | In use (scaffold) | request → numeric record                           |
| Entropy & histograms | hand-written                                    | In use            | Shannon entropy, byte histogram, char-class counts |
| Rule engine          | regex / keyword, hand-written                   | Decided           | public attack signatures as data                   |
| Chi-square test      | hand-written                                    | Decided           | character-distribution test (Kruegel & Vigna 2003) |
| Confidence intervals | hand-written                                    | Decided           | per-parameter length model                         |
| Outlier detection    | z-score / IQR / MAD; Mahalanobis (multivariate) | Decided           | robust estimators where needed                     |

No external statistics library in `core`: the methods are the learning objective, so we
implement them. (If a reference implementation is wanted for cross-checking in _tests only_, that
is an ADR.)

## 4. `server` — live monitor (Node only)

| Component   | Choice  | Version | Status  | Notes                                               |
| ----------- | ------- | ------- | ------- | --------------------------------------------------- |
| HTTP server | Express | ^4.21   | Decided | `POST /ingest`, `GET /health`; binds to `localhost` |

## 5. `dashboard` — browser app (→ GitHub Pages)

| Component          | Choice                  | Version | Status   | Notes                                                                      |
| ------------------ | ----------------------- | ------- | -------- | -------------------------------------------------------------------------- |
| Build / dev server | Vite                    | ^6.0    | Decided  | `base: './'` so it works at any Pages path                                 |
| UI                 | vanilla JS + HTML + CSS | —       | Decided  | no framework for a small dashboard                                         |
| Charts             | Chart.js                | ^4.4    | Proposed | ROC curve, histograms, confusion-matrix heatmap — add when building charts |

## 6. Hosting

| Component      | Choice                                                       | Status  | Notes                                                                                                            |
| -------------- | ------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| Static hosting | GitHub Pages                                                 | Decided | serves the `dashboard` build; no server runs there                                                               |
| Publish        | manual `npm run build` + push `dist/` to a `gh-pages` branch | Decided | no CI auto-deploy (ADR-005); the usual one-line Actions workflow is intentionally omitted and can be added later |

## 7. Explicitly not used

- **TypeScript compile step** — JSDoc types are enough for this size; revisit with an ADR.
- **Jest / Vitest** — `node:test` covers the library logic.
- **A statistics package (simple-statistics, jStat, …) in `core`** — the methods are the point
  of the exercise. Allowed in tests for cross-checking only, via an ADR.
- **Any real traffic capture / proxy / scanner** — out of scope (brief, standards §5).
