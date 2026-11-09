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
    ├── dashboard/            # Vite browser app (→ GitHub Pages)
    └── experiments/          # (planned, D-04) Node-only runner: seeds → results/
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
- `experiments` (planned, D-04 — ADR-009) is **Node-only**: it depends on `core`, `traffic` and
  `evaluation`, runs the seeded experiments and may use `fs` to write `results/`. It is the only
  place experiment code touches the file system, so the three pure packages stay pure.
- Purity is enforced by ESLint (`eslint.config.js`): in `core`, `traffic` and `evaluation` `src/`,
  browser globals, Node globals and modules, `fetch` and `Math.random` are errors.
- A workspace **never** reaches into another workspace's `src/` internals — import from its
  package entry (`@anomaly-guard/<name>`).

| Workspace     | Area             | Owner          | Key exports (planned)                                                                                   |
| ------------- | ---------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `core`        | detection engine | **C** + shared | `extractFeatures`, `RuleEngine`, `trainStatModel`, `scoreRequest`, `paramKey`, `pToScore`, `detect`     |
| `traffic`     | data             | **A**          | `createRng`, `makeLegitRequest`, `makeAttackRequest`, `buildDataset` (train / calibration / test)       |
| `evaluation`  | evaluation       | **D**          | `confusionMatrix`, `metrics`, `rocCurve`, `positivePredictiveValue`, `thresholdAtFpr`, `wilsonInterval` |
| `server`      | server/rules     | **B**          | Express app: `POST /ingest`, `GET /health`                                                              |
| `dashboard`   | UI + report      | **E**          | browser app; GitHub Pages build                                                                         |
| `experiments` | experiment runs  | **D**          | (planned, D-04) multi-seed runner writing `results/`                                                    |

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
│   │   ├── entropy.js        # Shannon entropy, the seven character classes
│   │   └── anomaly.js        # per-(path, param) model, length bound, chi-square, outliers
│   └── detector/
│       └── detect.js         # combine rule hits + stat scores → explained verdict
└── test/                     # one file per area, so owners rarely edit the same file
    ├── entropy.test.js
    ├── features.test.js
    ├── rules.test.js
    ├── anomaly.test.js
    └── detect.test.js
```

- **`features/extract.js`** is the only place that reads the raw request shape. Everything
  downstream consumes the numeric record, so adding a feature is a one-file change.
- **`stats/*`** functions are pure and return scores on the `−log10(p)` scale (ADR-007);
  thresholds are applied by callers.
- **`detector/detect.js`** returns `{ verdict, score, reasons, … }`: one continuous score per mode
  (so the ROC can sweep every configuration) and `reasons` naming the rule or signal that fired —
  the dashboard needs this to explain a decision.

## 4. Runtime boundary (why `core` is pure)

The dashboard is hosted on **GitHub Pages**, which serves static files only — no Node process
runs there. So the whole detection pipeline has to be able to run **in the browser**. Keeping
`core` (and `traffic`, `evaluation`) free of Node-only APIs is what makes the Pages demo
possible and what lets `node:test` exercise the same code. The `server` workspace is the only
Node-only piece; it is for the local "realistic" demo, not for Pages. See
[`adr/ADR-003-client-side-first-for-github-pages.md`](adr/ADR-003-client-side-first-for-github-pages.md).
