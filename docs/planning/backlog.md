# Backlog & work plan

> Tasks to deliver the scope of [`../project-brief.md`](../project-brief.md). Each task is one
> branch and one PR (standards §7). Update the **Status** here in the same PR. Task ids group by
> owner area (A traffic, B server/rules, C stats, D evaluation, E dashboard/report); **F** = shared
> foundations. The decisions the specs below rely on are in ADR-006 – ADR-009.

## 1. States

| State              | Meaning                                                 |
| ------------------ | ------------------------------------------------------- |
| `Ready`            | Can be picked now (dependencies done)                   |
| `Ready (baseline)` | Can be picked now; a working baseline exists to improve |
| `In progress`      | A draft PR exists                                       |
| `Blocked`          | Waiting on a dependency or a decision                   |
| `Done`             | Merged                                                  |

## 2. Foundations (shared)

| ID   | Task                                                                                                                                                                                                    | Depends on | Status      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| F-01 | Monorepo scaffold: workspaces, scripts, lint/format, docs, ADRs                                                                                                                                         | —          | Done        |
| F-02 | `core` public surface + feature-extraction contract                                                                                                                                                     | F-01       | Done        |
| F-03 | Shannon entropy + character-class counts (+ tests)                                                                                                                                                      | F-02       | Done        |
| F-04 | Fixed character classes (`CHAR_CLASSES`), documented — seven classes since ADR-008                                                                                                                      | F-02       | Done        |
| F-05 | Methodology foundations: ADR-006–009; attacks injected into legit requests, `variant`, `calibration` split; per-(path, param) model; −log10(p) scale; continuous detector score; purity lint; doc fixes | F-04       | In progress |

## 3. A — Traffic & dataset (`packages/traffic`)

| ID   | Task                                                                                                                           | Depends on | Status           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- |
| A-01 | Seeded RNG (reproducible) + tests                                                                                              | F-01       | Done             |
| A-02 | **Realistic legitimate traffic** — checklist below. The validity of every result depends on it                                 | F-05       | Ready (baseline) |
| A-03 | Canonical attacks: more public example payloads per targeted family (sqli, xss, traversal, cmdi)                               | F-05       | Ready (baseline) |
| A-04 | Obfuscated and novel attacks (ADR-006 definitions) — checklist below                                                           | A-03       | Ready            |
| A-05 | Hard cases: a committed fixture file + `variant: 'hard'` legit samples mixed into the **test** set (e.g. a `hardShare` option) | A-02       | Ready            |
| A-06 | `buildDataset` → `train` / `calibration` / `test`, every sample `{ request, label, kind, variant }`                            | F-05       | Done (baseline)  |

**A-02 checklist — what "realistic" means here:**

- More endpoints and parameters, often several per request (e.g. `/products?id=…&sort=…`,
  `/search?q=…&page=…`, a cart form with `id` and `qty`, a profile form with `email` and `bio`).
- Values that look like real input: mixed case (names, sentence case), punctuation (`. , ! ? : -`),
  apostrophes (`l'ordine`, `O'Brien`), accents and some non-Latin text, numbers in context (prices,
  dates, product codes), synthetic emails on the reserved domain `example.com`, links to
  `https://example.com/…` inside comments, passwords of varying length with symbols.
- Skewed lengths with a long tail (most comments short, a few of 1000+ characters), not narrow
  uniform ranges: today `page` has σ = 0.39 characters, which makes any attack in it trivial.
- The same generators feed `train`, `calibration` and `test`, so unusual-but-legit input appears
  everywhere at its natural, low rate. Seeded only; no real data (standards §4).

**A-04 checklist:**

- _Obfuscated_ (targeted families, transformed): double URL encoding, comments inside keywords
  (`UN/**/ION`), mixed case, alternative whitespace (tab, newline), string concatenation, HTML
  entities.
- _Novel_ (families the rules have no signature for — fix the list **before** looking at
  results): e.g. template injection, LDAP injection, NoSQL operator injection, CRLF/header
  injection, plus the existing `oversized`.
- _Mimicry_: short attacks that look normal (`1 OR 1=1`, `admin'--`), labelled by how they were made.
- Public, well-known example strings only, never executed (ADR-001).

## 4. B — Server & rules (`packages/server`, `core/rules`)

| ID   | Task                                                                                                                                                   | Depends on | Status           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- |
| B-01 | Rule engine: signatures for the **canonical** families only, written without looking at obfuscated/novel payloads (ADR-006); keep "which rule hit"     | F-05       | Ready (baseline) |
| B-02 | Express monitor: threshold from a legit-only calibration batch at startup (`thresholdAtFpr`, D-06) instead of the fixed placeholder; validate the body | D-06       | Ready (baseline) |
| B-03 | Request log + verdict stream for the dashboard                                                                                                         | B-02       | Ready            |

## 5. C — Statistical models (`core/stats`, `core/detector`)

| ID   | Task                                                                                                                                                                                                                 | Depends on | Status           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| C-03 | **Chi-square score** (ADR-008, methods §4): Laplace-smoothed expected counts, df = 6, survival function in log space, score −log10(p), worst parameter; known-answer tests (χ² = 12.592 → p ≈ 0.05) and monotonicity | F-05       | Ready            |
| C-04 | Length model: Chebyshev baseline in place → decide the policy for unseen (path, param) pairs, try a log-transform or robust version, compare with the prediction interval                                            | F-05       | Ready (baseline) |
| C-05 | Outliers: IQR / MAD; Mahalanobis with a regularised covariance — each returns a tail probability → score                                                                                                             | F-05       | Ready            |
| C-06 | Add C-03/C-04/C-05 to `scoreRequest` (max of the parts, ADR-007) and the model fields they need                                                                                                                      | C-03       | Blocked          |
| C-07 | Detector explanations: which signal, which parameter, which probability (continuous score per mode already in place)                                                                                                 | C-06       | Blocked          |
| C-08 | Dataset-level chi-square test of homogeneity, legit vs attack (methods §4b), for the report                                                                                                                          | C-03       | Blocked          |

## 6. D — Evaluation (`packages/evaluation`, `packages/experiments`)

| ID   | Task                                                                                                                                                                                                                 | Depends on       | Status           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------- |
| D-01 | Confusion matrix + precision/recall/F1/FPR/FNR (+ tests)                                                                                                                                                             | F-01             | Done             |
| D-02 | Base-rate / PPV helper (Bayes) (+ test)                                                                                                                                                                              | D-01             | Done             |
| D-03 | ROC curve + AUC (threshold sweep; handles ties and `+Infinity` scores)                                                                                                                                               | D-01             | Ready            |
| D-04 | Experiment runner in a new Node-only workspace `packages/experiments`: ≥ 20 seeds; rules / stats / combined; per-variant breakdown; at target FPR 1% and 0.1%, plus ROC/AUC; writes `results/` with seeds and commit | D-03, D-05, D-06 | Ready (baseline) |
| D-05 | Confidence intervals: `wilsonInterval` for rates; seeded bootstrap for AUC (methods §6)                                                                                                                              | D-01             | Ready            |
| D-06 | `thresholdAtFpr(legitScores, targetFpr)` on the calibration split (ADR-009); tests with ties                                                                                                                         | D-01             | Ready            |

## 7. E — Dashboard & report (`packages/dashboard`, `docs/`)

| ID   | Task                                                                                                                             | Depends on | Status          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| E-01 | Dashboard boot (Vite), runs the pipeline client-side, shows a verdict table with the variant                                     | F-05       | Done (baseline) |
| E-02 | Charts: character-class distribution, score distributions (normal vs. attack), ROC (Chart.js)                                    | E-01, D-03 | Ready           |
| E-03 | Confusion-matrix view + base-rate explainer (PPV vs. prevalence)                                                                 | E-01, D-02 | Ready           |
| E-04 | GitHub Pages publish (procedure in the dashboard README; needs a public repo or GitHub Pro)                                      | E-01       | Ready           |
| E-05 | Final report: methods, results, FP/FN discussion, base-rate, limitations; cite Kruegel & Vigna 2003; **per-member contribution** | D-04       | Blocked         |
| E-06 | Target-FPR control (threshold from the calibration split via D-06) + per-variant results table                                   | D-06       | Blocked         |

## 8. Suggested first wave (parallel, few conflicts)

| Owner | Pick up                                     |
| ----- | ------------------------------------------- |
| A     | A-02 first (it decides validity), then A-04 |
| B     | B-01, then B-03                             |
| C     | C-03 (the headline method), then C-04       |
| D     | D-06 and D-03, then D-05                    |
| E     | E-03 and E-04, then E-02                    |

The critical path is **C-03 → C-06 → D-04 → E-05**, with **A-02** alongside it: without
realistic legitimate traffic every downstream number is too optimistic.

**Fewer than five people?** Merge areas that rarely touch the same files: with four, B + E (rules,
server, dashboard); with three, A + B (data and rules — fine, because "novel" is defined by
family, not by what the rules miss) and D + E (evaluation, dashboard). Everyone writes the report
section on their own area.
