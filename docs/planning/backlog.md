# Backlog & work plan

> Tasks to deliver the scope of [`../project-brief.md`](../project-brief.md). Each task is one
> branch and one PR (standards §7). Update the **Status** here in the same PR. Task ids group by
> package area (A traffic, B server/rules, C stats, D evaluation, E dashboard/report; **F** =
> shared foundations), but **the work is split by statistical theme** (T1–T4, §8): the **Theme**
> column says who picks each task up. The decisions the specs below rely on are in ADR-006 –
> ADR-009.

## 1. States

| State              | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `Ready`            | Can be picked now (dependencies done)                              |
| `Ready (baseline)` | Can be picked now; a working baseline exists to improve            |
| `In progress`      | A draft PR exists                                                  |
| `Blocked`          | Waiting on a dependency or a decision                              |
| `Proposed`         | Optional extension: the group agrees on it before anyone starts it |
| `Cut`              | Dropped by the group: not needed to answer the research question   |
| `Done`             | Merged                                                             |

## 2. Foundations (shared)

| ID   | Task                                                                                                                                                                                                                                                       | Depends on | Status |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| F-01 | Monorepo scaffold: workspaces, scripts, lint/format, docs, ADRs                                                                                                                                                                                            | —          | Done   |
| F-02 | `core` public surface + feature-extraction contract                                                                                                                                                                                                        | F-01       | Done   |
| F-03 | Shannon entropy + character-class counts (+ tests)                                                                                                                                                                                                         | F-02       | Done   |
| F-04 | Fixed character classes (`CHAR_CLASSES`), documented — seven classes since ADR-008                                                                                                                                                                         | F-02       | Done   |
| F-05 | Methodology foundations: ADR-006–009; attacks injected into legit requests, `variant`, `calibration` split; per-(path, param) model with one file per signal; −log10(p) scale; continuous detector score; purity lint; doc fixes; work split by theme (§8) | F-04       | Done   |
| F-06 | Team setup, one command for everyone (`npm run team-setup`): e-mail private on GitHub, noreply commit identity, pre-commit check, invitation accepted                                                                                                      | F-01       | Done   |
| F-07 | Repository moved to the organization `the-anomaly-guard`: neutral addresses, every member an owner; links, demo, team guide and team setup updated                                                                                                         | F-06       | Done   |

## 3. A — Traffic & dataset (`packages/traffic`)

| ID   | Task                                                                                                                                     | Theme | Depends on | Status           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | ---------------- |
| A-01 | Seeded RNG (reproducible) + tests                                                                                                        | T4    | F-01       | Done             |
| A-02 | **Realistic legitimate traffic**, written as an explicit probability model — checklist below. The validity of every result depends on it | T4    | F-05       | Ready (baseline) |
| A-03 | Canonical attacks: more public example payloads per targeted family (sqli, xss, traversal, cmdi)                                         | T4    | F-05       | Ready (baseline) |
| A-04 | Obfuscated and novel attacks (ADR-006 definitions) — checklist below                                                                     | T4    | A-03       | Ready            |
| A-05 | Hard cases: a committed fixture file + `variant: 'hard'` legit samples mixed into the **test** set (e.g. a `hardShare` option)           | T4    | A-02       | Ready            |
| A-06 | `buildDataset` → `train` / `calibration` / `test`, every sample `{ request, label, kind, variant }`                                      | T4    | F-05       | Done (baseline)  |

**A-02 checklist — what "realistic" means here:**

- **Write the model down first** — that is what makes A-02 statistics. For each endpoint and
  parameter, name the distribution its values come from: e.g. the endpoint mix is categorical
  with fixed weights; words follow a Zipf law (a few very common, many rare); free-text lengths
  are log-normal (most short, a long right tail); page numbers and quantities are geometric.
  Sample them with the seeded RNG (inverse CDF for the discrete ones, Box–Muller for the normal
  behind a log-normal) and check on a generated sample that histograms, means and quantiles match
  what you wrote down.
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

| ID   | Task                                                                                                                                                   | Theme | Depends on | Status           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | ---------------- |
| B-01 | Rule engine: signatures for the **canonical** families only, written without looking at obfuscated/novel payloads (ADR-006); keep "which rule hit"     | T1    | F-05       | Ready (baseline) |
| B-02 | Express monitor: threshold from a legit-only calibration batch at startup (`thresholdAtFpr`, D-06) instead of the fixed placeholder; validate the body | T3    | D-06       | Ready (baseline) |
| B-03 | Request log + verdict stream for the dashboard                                                                                                         | —     | B-02       | Cut              |

## 5. C — Statistical models (`core/stats`, `core/detector`)

| ID   | Task                                                                                                                                                                                                                                         | Theme | Depends on | Status           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | ---------------- |
| C-03 | **Chi-square score** in `stats/chisquare.js` (ADR-008, methods §4): Laplace-smoothed expected counts, df = 6, survival function in log space, score −log10(p), worst parameter; known-answer tests (χ² = 12.592 → p ≈ 0.05) and monotonicity | T1    | F-05       | Ready            |
| C-04 | Length model in `stats/length.js`: Chebyshev baseline in place → decide the policy for unseen (path, param) pairs, try a log-transform or robust version, compare with the prediction interval                                               | T2    | F-05       | Ready (baseline) |
| C-05 | Outliers in `stats/outliers.js`: IQR / MAD; Mahalanobis with a regularised covariance — each returns a tail probability → score                                                                                                              | T2    | F-05       | Ready            |
| C-06 | Add C-03/C-04/C-05 to `scoreRequest` (`stats/anomaly.js`; max of the parts, ADR-007) and the model fields they need                                                                                                                          | T2    | C-03       | Blocked          |
| C-07 | Detector explanations: which signal, which parameter, which probability (continuous score per mode already in place)                                                                                                                         | T2    | C-06       | Blocked          |
| C-08 | For the report, legit vs attack over the whole test set: chi-square test of homogeneity on the seven classes (methods §4b), and the entropy distributions of the two groups (does entropy alone separate them?)                              | T1    | C-03       | Blocked          |

## 6. D — Evaluation (`packages/evaluation`, `packages/experiments`)

| ID   | Task                                                                                                                                                                                                                 | Theme | Depends on       | Status           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------- | ---------------- |
| D-01 | Confusion matrix + precision/recall/F1/FPR/FNR (+ tests)                                                                                                                                                             | T3    | F-01             | Done             |
| D-02 | Base-rate / PPV helper (Bayes) (+ test)                                                                                                                                                                              | T4    | D-01             | Done             |
| D-03 | ROC curve + AUC (threshold sweep; handles ties and `+Infinity` scores)                                                                                                                                               | T3    | D-01             | Ready            |
| D-04 | Experiment runner in a new Node-only workspace `packages/experiments`: ≥ 20 seeds; rules / stats / combined; per-variant breakdown; at target FPR 1% and 0.1%, plus ROC/AUC; writes `results/` with seeds and commit | T3    | D-03, D-05, D-06 | Ready (baseline) |
| D-05 | Confidence intervals: `wilsonInterval` for rates; seeded bootstrap for AUC (methods §6)                                                                                                                              | T3    | D-01             | Ready            |
| D-06 | `thresholdAtFpr(legitScores, targetFpr)` on the calibration split (ADR-009); tests with ties                                                                                                                         | T3    | D-01             | Ready            |
| D-07 | Paired comparison of two modes on the same test requests (e.g. stats vs combined): McNemar's test on the requests where only one of the two is right                                                                 | T3    | D-04             | Proposed         |

## 7. E — Dashboard & report (`packages/dashboard`, `docs/`)

| ID   | Task                                                                                                                                                                                                               | Theme      | Depends on       | Status          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- | --------------- |
| E-01 | Dashboard boot (Vite), runs the pipeline client-side, shows a verdict table with the variant                                                                                                                       | shared     | F-05             | Done (baseline) |
| E-02 | Charts (Chart.js), one per theme, in the placeholders of the console (ADR-010): character classes legit vs attack (T1) and lengths and scores legit vs attack (T2) on `models.html`, ROC (T3) on `evaluation.html` | T1, T2, T3 | E-01 (ROC: D-03) | Ready           |
| E-03 | Base-rate explainer on `base-rate.html`: PPV vs prevalence at the measured TPR and FPR (Bayes)                                                                                                                     | T4         | E-01, D-02       | Ready           |
| E-04 | GitHub Pages publish: <https://the-anomaly-guard.github.io/anomaly-guard/> (procedure in the dashboard README)                                                                                                     | anyone     | E-01             | Done            |
| E-05 | Final report: one chapter per theme; introduction, method overview, conclusions and limitations written together; cite Kruegel & Vigna 2003; **per-member contribution**                                           | all        | D-04             | Blocked         |
| E-06 | On `evaluation.html`: target-FPR control (threshold from the calibration split via D-06), confusion matrix and per-variant results table                                                                           | T3         | D-06             | Blocked         |
| E-07 | Multi-page, SIEM-style console (ADR-010): seven pages, settings in the URL, alert levels, CSP, placeholders for the theme charts; team guide for access and portfolios (`docs/guides/team-guide.md`)               | shared     | E-01             | Done            |

## 8. Work split by statistical theme

The exam is on statistics, so the work is split by **statistical theme**, not by package. Each
member owns one theme end to end — its functions and tests, its dashboard chart and its chapter
of the report — in whatever package the code lives. Each theme is one person's documented
contribution for the individual grade.

**T1 — Character distributions and chi-square** · member: _…_

- _Question:_ is the mix of characters in a value normal for that parameter?
- _Tasks:_ C-03, B-01, C-08; chart: character classes, legit vs attack (E-02).
- _Statistics:_ categorical distributions; goodness of fit vs homogeneity; degrees of freedom;
  p-values, and why the per-request one is only nominal (expected counts below 5); Laplace
  smoothing; Shannon entropy.

**T2 — Lengths and outliers** · member: _…_

- _Question:_ is a value too long, or unusual in combination with the others?
- _Tasks:_ C-04, C-05, C-06, C-07; chart: lengths and scores, legit vs attack (E-02).
- _Statistics:_ descriptive statistics and skewness; Chebyshev's inequality; prediction interval
  vs confidence interval; robust estimators (median, IQR, MAD); covariance and the Mahalanobis
  distance; combining several signals into one score.

**T3 — Evaluation and uncertainty** · member: _…_

- _Question:_ how often is the detector wrong, and how sure are we of those numbers?
- _Tasks:_ D-06, D-03, D-05, D-04, B-02, E-06, and D-07 if the group agrees; charts: ROC (E-02),
  confusion matrix (E-06).
- _Statistics:_ confusion matrix and error rates; empirical quantiles (the threshold at a target
  FPR); ROC/AUC and its link to the Mann–Whitney statistic; the Wilson interval for proportions;
  the bootstrap; variability across seeds; McNemar's test (D-07).

**T4 — Probability and simulation** · member: _…_

- _Question:_ what does normal traffic look like, and what happens when attacks are rare?
- _Tasks:_ A-02, A-03, A-04, A-05, E-03; chart: the base-rate explainer (E-03).
- _Statistics:_ probability distributions as a model of traffic (categorical, Zipf, log-normal,
  geometric); seeded simulation and sampling; dataset design (splits, prevalence); Bayes'
  theorem, the base-rate fallacy, PPV vs prevalence.

**Shared:** E-04 (republishing the demo — anyone, procedure in the dashboard README), E-07 (the
console each theme adds its chart to) and E-05 (the report:
one chapter per theme; introduction, method overview and conclusions written together). B-03 is
cut: it is engineering, not statistics, and the dashboard already runs the pipeline in the
browser.

**Why B-01 is in T1, not T4:** whoever generates the obfuscated and novel attacks (A-04) must not
write the signatures, or the rules would be written knowing what they have to catch (ADR-006).

### First wave (parallel, few conflicts)

| Theme | Start with                  | Then                                                         |
| ----- | --------------------------- | ------------------------------------------------------------ |
| T1    | C-03 (on the critical path) | B-01, without looking at the obfuscated/novel payloads; C-08 |
| T2    | C-04                        | C-05; C-06 once C-03 is merged                               |
| T3    | D-06 and D-03               | D-05, then D-04 and B-02                                     |
| T4    | A-02 (it decides validity)  | A-03 → A-04, A-05, then E-03                                 |

The critical path is **C-03 → C-06 → D-04 → E-05**, with **A-02** alongside it: without
realistic legitimate traffic every downstream number is too optimistic. Each signal has its own
file in `core/stats` (project-structure §3), so T1 and T2 rarely edit the same file.

**Other group sizes:** with three people, merge T1 and T2 (both are per-value signals in
`core/stats`); with five, split T3 into thresholds and ROC (D-06, D-03, B-02, E-06) and
uncertainty (D-05, D-04, D-07).
