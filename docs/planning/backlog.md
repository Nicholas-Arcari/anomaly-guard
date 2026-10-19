# Backlog & work plan

> Tasks to deliver the scope of [`../project-brief.md`](../project-brief.md). Each task is one
> branch and one PR (standards §7). Update the **Status** here in the same PR. Task ids group by
> owner area (A traffic, B server/rules, C stats, D evaluation, E dashboard/report); **F** = shared
> foundations.

## 1. States

| State         | Meaning                               |
| ------------- | ------------------------------------- |
| `Ready`       | Can be picked now (dependencies done) |
| `In progress` | A draft PR exists                     |
| `Blocked`     | Waiting on a dependency or a decision |
| `Done`        | Merged                                |

## 2. Foundations (shared)

| ID   | Task                                                            | Depends on | Owner | Status          |
| ---- | --------------------------------------------------------------- | ---------- | ----- | --------------- |
| F-01 | Monorepo scaffold: workspaces, scripts, lint/format, docs, ADRs | —          | —     | Done (scaffold) |
| F-02 | `core` public surface + feature-extraction contract             | F-01       | C     | Done (scaffold) |
| F-03 | Shannon entropy + char-class counts + byte histogram (+ tests)  | F-02       | C     | Done            |
| F-04 | Fixed `DEFAULT_ALPHABET` / binning, documented                  | F-02       | C     | Done (scaffold) |

## 3. A — Traffic & dataset (`packages/traffic`)

| ID   | Task                                                                                                                      | Depends on | Status             |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| A-01 | Seeded RNG (reproducible) + tests                                                                                         | F-01       | Done (scaffold)    |
| A-02 | Legitimate request generators (search, login, pagination, forms, free-text)                                               | A-01, F-02 | In progress (stub) |
| A-03 | Malicious generators: SQLi, XSS, path traversal, command injection, encoded/long inputs (public example strings, as data) | A-01       | Ready (stub)       |
| A-04 | **Novel / obfuscated** attacks the rules do not cover (for the stats-vs-signatures story)                                 | A-03       | Ready              |
| A-05 | "Hard cases" fixtures: legit-but-weird (`O'Brien`, long comment, non-Latin) and stealthy attacks (`1 OR 1=1`, mimicry)    | A-02, A-03 | Ready              |
| A-06 | `buildDataset(seed, size, prevalence)` → labelled `{request,label,kind}[]`, train/test split                              | A-02, A-03 | In progress (stub) |

## 4. B — Server & rules (`packages/server`, `core/rules`)

| ID   | Task                                                                           | Depends on | Status             |
| ---- | ------------------------------------------------------------------------------ | ---------- | ------------------ |
| B-01 | Rule engine: regex/keyword signatures as data, returns which rule hit          | F-02       | Ready (stub)       |
| B-02 | Express monitor: `POST /ingest` (runs detector), `GET /health`, localhost only | F-02, B-01 | In progress (stub) |
| B-03 | Request log + verdict stream for the dashboard                                 | B-02       | Ready              |

## 5. C — Statistical models (`core/stats`, `core/detector`)

| ID   | Task                                                                         | Depends on | Status                     |
| ---- | ---------------------------------------------------------------------------- | ---------- | -------------------------- |
| C-03 | Chi-square test on character distribution (binning, Yates, df, p-value)      | F-03, F-04 | Ready (stub)               |
| C-04 | Confidence-interval / z-score model on parameter lengths (train on normal)   | F-03       | Ready (stub)               |
| C-05 | Outlier detection: z-score / IQR / MAD; Mahalanobis (multivariate)           | F-03       | Ready (stub)               |
| C-06 | `trainStatModel(normal)` / `scoreRequest(model, req)` lifecycle              | C-03, C-04 | Ready (stub)               |
| C-07 | `detect(req, {rules, model, threshold})` → explained verdict (rules + stats) | B-01, C-06 | Blocked (needs B-01, C-06) |

## 6. D — Evaluation (`packages/evaluation`)

| ID   | Task                                                                                                           | Depends on       | Status       |
| ---- | -------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ |
| D-01 | Confusion matrix + precision/recall/F1/FPR/FNR (+ tests)                                                       | F-01             | Done         |
| D-02 | Base-rate / PPV helper (Bayes) (+ test)                                                                        | D-01             | Done         |
| D-03 | ROC curve + AUC (threshold sweep)                                                                              | D-01             | Ready (stub) |
| D-04 | Experiment runner: fixed seed → rules-only / stats-only / combined, known vs. novel attacks, writes `results/` | A-06, C-07, D-03 | Blocked      |

## 7. E — Dashboard & report (`packages/dashboard`, `docs/`)

| ID   | Task                                                                                                                             | Depends on | Status             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| E-01 | Dashboard boot (Vite), runs the pipeline client-side, shows a verdict table                                                      | F-02, A-06 | In progress (stub) |
| E-02 | Charts: character-distribution histogram, score distributions (normal vs. attack), ROC (Chart.js)                                | E-01, D-03 | Ready              |
| E-03 | Confusion-matrix view + base-rate explainer                                                                                      | E-01, D-02 | Ready              |
| E-04 | GitHub Pages publish (manual build + `gh-pages`)                                                                                 | E-01       | Ready              |
| E-05 | Final report: methods, results, FP/FN discussion, base-rate, limitations; cite Kruegel & Vigna 2003; **per-member contribution** | D-04       | Blocked            |

## 8. Suggested first wave (parallel, few conflicts)

| Owner | Pick up                          |
| ----- | -------------------------------- |
| A     | A-02, A-03, A-06                 |
| B     | B-01, B-02                       |
| C     | C-03 (the headline method), C-04 |
| D     | D-03 (ROC/AUC)                   |
| E     | E-01, then E-02                  |

The critical path is **C-03 → C-06 → C-07 → D-04 → E-05**: the chi-square model feeds the
detector, which feeds the experiment, which feeds the report.
