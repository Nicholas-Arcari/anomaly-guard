# CLAUDE.md — The Anomaly Guard

> Operating manual for anyone working on this repository — people and AI assistants
> (Claude Code, Codex, Copilot). Read it before touching the code.
> Details live in [`docs/development/`](docs/development/README.md); this file is the
> short, binding summary. Keep it under ~200 lines.

---

## 1. What this project is

**Project 5 — The Anomaly Guard** (master's course, extra-credit project). An educational
Intrusion Detection System that monitors **simulated** web requests (HTTP payloads, query
parameters, input lengths, character distributions) and decides, for each one, whether it is
normal or suspicious. It does so two ways and compares them:

1. **Rule engine** — regex / keyword signatures. Precise on known attacks, blind to new or
   obfuscated ones.
2. **Statistical anomaly detection** — learn what _normal_ traffic looks like, then flag what
   departs from it. No prior knowledge of the attack is required.

The research question (binding scope): **how much can statistics catch without pre-defined
signatures, and how often does it get it wrong?** So the deliverable is an _experiment_ with an
honest evaluation of false positives and false negatives — not a production IDS.

The full assignment is pinned in [`docs/project-brief.md`](docs/project-brief.md). A feature
that is not in the brief is **out of scope** (§2): propose it, do not build it on your own.

---

## 2. Scope — in and out

**In scope:** a traffic generator (legitimate + malicious samples, including _novel_ attacks the
rules do not know); feature extraction; a rule engine; a statistical model trained on normal
traffic; a detector that combines the two; an evaluation harness (confusion matrix, FPR/FNR,
precision/recall/F1, ROC/AUC, base-rate analysis); a browser dashboard; a written report.

**Out of scope — do not build:** any real network capture; sending requests to any real host;
executing, running, or "detonating" any payload; attacking, scanning, or fuzzing a live target;
persisting real personal data. All traffic is **synthetic and local**. If a task seems to need
any of the above, stop and ask — the answer is almost always "simulate it instead".

---

## 3. Tech stack (LOCKED — new tech needs an ADR)

| Layer         | Choice                                         | Notes                                                                |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Language      | JavaScript (ES modules), `"type": "module"`    | No TypeScript compile step; JSDoc for types                          |
| Runtime       | Node.js ≥ 22 LTS                               | `engines` in `package.json`                                          |
| Monorepo      | npm **workspaces** (`packages/*`)              | No Lerna/Turborepo/pnpm                                              |
| Shared engine | `@anomaly-guard/core`                          | Pure JS — **no DOM, no Node-only APIs** (runs in browser _and_ Node) |
| Server        | Express 4 (`@anomaly-guard/server`)            | Node-only; the "realistic" live monitor                              |
| Dashboard     | Vite + vanilla JS (`@anomaly-guard/dashboard`) | Multi-page console (ADR-010) → **GitHub Pages**; charts: Chart.js    |
| Tests         | `node:test` + `node --test`                    | Zero-config, no Jest/Vitest                                          |
| Lint / format | ESLint 9 (flat) + Prettier                     | Local only; **no CI** by design (ADR-005)                            |
| Hosting       | GitHub Pages (static)                          | The dashboard must run **fully client-side** (§5)                    |

Full list with rationale: [`docs/development/tech-stack.md`](docs/development/tech-stack.md).

---

## 4. Repository layout & who owns what

Workspaces in `packages/`: `core` (features, rules, statistical models, detector — imported by
everything, so it must never couple to a runtime), `traffic` (seeded generator, labelled dataset),
`evaluation` (metrics, ROC/AUC, base rate), `server` (Express live monitor), `dashboard` (browser
UI, GitHub Pages build). Tree + dependency rules:
[`docs/development/project-structure.md`](docs/development/project-structure.md).

**Work is owned by statistical theme, not by package** — the exam is on statistics. Each member
owns one theme end to end (functions, tests, dashboard chart, report chapter) wherever the code
lives, so every contribution is documentable for the individual grade. Details and first wave:
[`docs/planning/backlog.md`](docs/planning/backlog.md) §8.

| Theme                                 | Tasks                   |
| ------------------------------------- | ----------------------- |
| **T1** Character distributions and χ² | C-03, C-08, B-01        |
| **T2** Lengths and outliers           | C-04 – C-07             |
| **T3** Evaluation and uncertainty     | D-03 – D-06, B-02, E-06 |
| **T4** Probability and simulation     | A-02 – A-05, E-03       |

---

## 5. Hard rules (invariants — do not violate)

- **Train on normal only.** The statistical model is fitted on _legitimate_ traffic alone. The
  labelled test set is held out. **Never fit on the test set and never let labels leak into
  training** — that is the single most common way to fake a good result.
- **Methods return a score, not a verdict.** Every statistical signal (chi-square, length bound,
  outlier) returns `s = −log10(p)` (higher = more anomalous, ADR-007), and the _threshold_ is
  applied outside it. ROC needs to sweep that threshold, so a method that bakes in a hard
  yes/no destroys the analysis.
- **`core` is runtime-agnostic.** No `window`, `document`, `fetch`, `fs`, `process`, `express`
  inside `core`. It must import and run identically in the browser (for the Pages demo) and in
  Node (for the server and tests).
- **Payloads are data, never code.** The generator produces attack _strings_; the detector only
  _measures_ them (length, character counts, entropy, regex match). Nothing ever `eval`s,
  executes, requests, or writes them to a shell, a DOM, or a query. No real request leaves the
  machine.
- **Reproducible experiments.** The traffic generator takes an explicit **seed**; same seed →
  same dataset. Record the seed and git commit with every reported result. No unseeded
  `Math.random()` in the generator or the experiments (ESLint enforces it in the pure packages).
- **Honest evaluation.** Set the operating threshold on the legit-only calibration split at a
  target FPR, never by looking at the test set (ADR-009). Always report the confusion matrix and
  both error rates (FPR _and_ FNR), not just accuracy — the classes are imbalanced. Keep the "hard
  cases": legitimate-but-weird (`O'Brien`, long free-text, non-Latin text) for false positives;
  short/mimicry attacks (`1 OR 1=1`) for false negatives.
- **No real data.** Datasets are synthetic. No real names, emails, credentials, IPs, or captured
  traffic in code, tests, or committed data.

---

## 6. Mandatory patterns

- **Feature extraction** (`core/src/features`) turns one request into a flat record of numbers
  (total length, per-parameter length, param count, character-class counts and ratios,
  Shannon entropy, method, encoding flags). Detectors and the report consume _that record_,
  never the raw request, so a new feature is added in one place.
- **Statistical model lifecycle:** `train(normalRequests) → model`, then
  `score(model, request) → number`. Training and scoring are separate calls (see the
  train-on-normal rule). The model is a plain serialisable object, kept per (path, parameter).
- **Detector** (`core/src/detector`) combines rule hits and statistical scores into a verdict
  **at a given threshold**, and returns _why_ (which rule, which feature, which score) so the
  dashboard can explain it.
- **Dataset is labelled** (`traffic`): every sample is `{ request, label, kind, variant }`; an
  attack is a legit request with one parameter value replaced by a payload (ADR-006). Labels and
  variants drive evaluation only — never training.
- **Numbers:** character distributions use the seven fixed `CHAR_CLASSES` (ADR-008, see
  [`docs/statistics/methods.md`](docs/statistics/methods.md) §0); don't improvise per call.

---

## 7. Common mistakes to avoid

- **Never** fit the statistical model on data that includes attacks or on the test split.
- **Never** report a single accuracy number for an imbalanced set — show the confusion matrix,
  FPR, FNR, and the ROC. Mention the **base-rate fallacy**: at a 0.1% attack rate even a 1% FPR
  drowns true attacks in false alarms (Bayes — worked in `methods.md`).
- **Never** present the per-request chi-square p-value as a probability: with tiny expected
  counts it is only a score (ADR-008). The valid test is the dataset-level one (`methods.md` §4b).
- **Never** hardcode a decision threshold inside a scoring function (breaks the ROC sweep).
- **Never** import a browser or Node API from `core` (breaks the GitHub Pages demo or the tests).
- **Never** execute, request, or shell out a generated payload — it is a measurement subject.
- **Never** use unseeded randomness in the generator or experiments (breaks reproducibility).
- **Never** leave a `TODO` without a backlog id: `// TODO(C-03): add the chi-square part`.
- **Never** introduce a dependency that is not in `tech-stack.md` without an ADR.

---

## 8. Workflow

- **Language:** code, identifiers, comments, logs, commit messages in **English** (default).
  Docs are English; `README.it.md` and the report may be Italian. Keep it consistent within a
  file.
- **Branch per task:** `<type>/<id>-<short-desc>`, e.g. `feat/c-03-chi-square`. One task = one
  branch = one PR. Update [`docs/planning/backlog.md`](docs/planning/backlog.md) in the same PR.
- **Conventional Commits**, English: `feat(stats): add chi-square character test`. Types:
  `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `perf`, `revert`.
- **ADR for decisions:** a new library, a change to the detection method, or a deviation from the
  standards gets an ADR in [`docs/development/adr/`](docs/development/adr/README.md).
- **No CI** (ADR-005): the checks are not enforced by a gate, so run them yourself (§9) and
  report the real outcome. This is a deliberate choice for a private student repo, not an
  oversight.

---

## 9. Before you say it's done

Run the checks for the area you touched and report the **real** result (if something fails or
you skipped it, say so):

```bash
npm install          # once, from the repo root (sets up all workspaces)
npm run team-setup   # once per computer: noreply commit e-mail + pre-commit check
npm test             # node:test across every package
npm run lint         # eslint
npm run format:check # prettier
npm run build        # dashboard static build (when the UI changed)
```

Then, in your summary: what changed and why (with the backlog id / brief section / ADR), which
checks you ran and their outcome, open questions, and **your individual contribution** for the
grade.

---

## 10. Quick reference

```
Live demo:            https://the-anomaly-guard.github.io/anomaly-guard/
Team guide:           docs/guides/team-guide.md
Assignment (scope):   docs/project-brief.md
Dev rules:            docs/development/standards.md
Structure + deps:     docs/development/project-structure.md
Tech stack:           docs/development/tech-stack.md
Decisions (ADR):      docs/development/adr/README.md
The statistics:       docs/statistics/methods.md
Task board:           docs/planning/backlog.md

Shared engine:        packages/core/src/{features,rules,stats,detector}
Traffic + dataset:    packages/traffic/src
Evaluation harness:   packages/evaluation/src
Express monitor:      packages/server/src
Dashboard (Pages):    packages/dashboard/src
```

Reference paper to cite in the report: Kruegel & Vigna, _Anomaly Detection of Web-based Attacks_
(CCS 2003) — the character-distribution / chi-square idea at the heart of this project.
