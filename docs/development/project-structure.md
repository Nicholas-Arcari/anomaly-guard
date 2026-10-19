# Project structure

## 1. Repository

```
anomaly-guard/
├── CLAUDE.md                 # Contributor & agent manual (binding summary)
├── AGENTS.md                 # Pointer to CLAUDE.md
├── README.md / README.it.md  # Overview (EN default / IT)
├── package.json              # npm workspaces root, shared scripts
├── eslint.config.js          # ESLint 9 flat config
├── .prettierrc.json          # Prettier config
├── .editorconfig
├── .github/
│   └── pull_request_template.md
├── docs/
│   ├── project-brief.md      # The assignment (scope)
│   ├── development/          # standards, project-structure, tech-stack, adr/
│   ├── statistics/           # methods.md — the maths
│   └── planning/             # backlog.md — task board
└── packages/
    ├── core/                 # shared engine (pure JS)
    ├── traffic/              # traffic generator + dataset
    ├── evaluation/           # metrics, ROC/AUC, base-rate
    ├── server/               # Express live monitor (Node only)
    └── dashboard/            # Vite browser app (→ GitHub Pages)
```

**Rules:**

- Each `packages/*` workspace is self-contained: its own `package.json`, `src/`, `test/`,
  `README.md`.
- Application code lives only in `packages/`. No service-specific config in the root.
- Generated datasets and results go to `data/` and `results/` (git-ignored), never committed
  (except a small fixed fixture set used by tests).

## 2. Workspaces, dependencies & ownership

```
            ┌──────────────────────────────────────────┐
            │                   core                    │  (pure JS: no DOM, no Node API)
            │  features · rules · stats · detector      │
            └───────▲───────────▲───────────▲───────────┘
                    │           │           │
        ┌───────────┴──┐   ┌────┴─────┐   ┌─┴──────────────┐
        │   traffic    │   │  server  │   │   dashboard    │
        │ (gen+dataset)│   │ (Express)│   │ (Vite→Pages)   │
        └───────▲──────┘   └──────────┘   └───────▲────────┘
                │                                 │
                └────────────┐      ┌─────────────┘
                             │      │
                        ┌────┴──────┴────┐
                        │   evaluation   │  (metrics; used by experiments + dashboard)
                        └────────────────┘
```

- `core` depends on **nothing** in this repo and on no runtime API. Everyone imports it.
- `traffic`, `server`, `dashboard` depend on `core`. `dashboard` also depends on `traffic` and
  `evaluation` (it can run the whole pipeline client-side).
- `evaluation` depends only on plain data (arrays of `{ label, score }`); keep it decoupled from
  `core` so it can score any detector.
- A workspace **never** reaches into another workspace's `src/` internals — import from its
  package entry (`@anomaly-guard/<name>`).

| Workspace    | Area             | Owner          | Key exports (planned)                                                       |
| ------------ | ---------------- | -------------- | --------------------------------------------------------------------------- |
| `core`       | detection engine | **C** + shared | `extractFeatures`, `RuleEngine`, `trainStatModel`, `scoreRequest`, `detect` |
| `traffic`    | data             | **A**          | `createRng`, `makeLegitRequest`, `makeAttackRequest`, `buildDataset`        |
| `evaluation` | evaluation       | **D**          | `confusionMatrix`, `metrics`, `rocCurve`, `auc`, `positivePredictiveValue`  |
| `server`     | server/rules     | **B**          | Express app: `POST /ingest`, `GET /health`                                  |
| `dashboard`  | UI + report      | **E**          | browser app; GitHub Pages build                                             |

## 3. `packages/core` internals

```
core/
├── package.json
├── src/
│   ├── index.js              # public surface (re-exports)
│   ├── features/
│   │   └── extract.js        # request → flat numeric feature record
│   ├── rules/
│   │   └── engine.js         # signature / regex rule engine
│   ├── stats/
│   │   ├── entropy.js        # Shannon entropy, byte histogram, char-class counts
│   │   └── anomaly.js        # chi-square, confidence-interval model, outlier scores
│   └── detector/
│       └── detect.js         # combine rule hits + stat scores → explained verdict
└── test/
    └── entropy.test.js
```

- **`features/extract.js`** is the only place that reads the raw request shape. Everything
  downstream consumes the numeric record, so adding a feature is a one-file change.
- **`stats/*`** functions are pure and return scores/p-values; thresholds are applied by callers.
- **`detector/detect.js`** returns `{ verdict, reasons }` where `reasons` names the rule or
  feature that fired — the dashboard needs this to explain a decision.

## 4. Runtime boundary (why `core` is pure)

The dashboard is hosted on **GitHub Pages**, which serves static files only — no Node process
runs there. So the whole detection pipeline has to be able to run **in the browser**. Keeping
`core` (and `traffic`, `evaluation`) free of Node-only APIs is what makes the Pages demo
possible and what lets `node:test` exercise the same code. The `server` workspace is the only
Node-only piece; it is for the local "realistic" demo, not for Pages. See
[`adr/ADR-003-client-side-first-for-github-pages.md`](adr/ADR-003-client-side-first-for-github-pages.md).
