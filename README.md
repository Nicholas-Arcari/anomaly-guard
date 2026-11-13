# The Anomaly Guard

> Educational Intrusion Detection System — Project 5, master's course (extra-credit).
> Italiano: [`README.it.md`](README.it.md).

The Anomaly Guard monitors **simulated** web requests and decides, for each one, whether it is
normal or suspicious. It combines a classic **rule engine** (regex / keyword signatures) with
**statistical anomaly detection** (learn what normal traffic looks like, then flag what departs
from it), and then measures — honestly — how often each approach is right and wrong.

**Research question:** how much can statistics catch _without_ pre-defined attack signatures,
and at what cost in false positives and false negatives?

**Live demo:** <https://the-anomaly-guard.github.io/anomaly-guard/> — runs entirely in your browser.

This is an **experiment**, not a production IDS. All traffic is synthetic and local — nothing is
captured from a real network, and no payload is ever executed or sent anywhere. See the scope
boundaries in [`AGENTS.md`](AGENTS.md) §2.

## What's inside

| Workspace                                      | What it does                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core)               | Feature extraction, rule engine, statistical models, detector (pure JS, runs in browser and Node)              |
| [`packages/traffic`](packages/traffic)         | Seeded generator of legitimate + malicious requests, labelled dataset                                          |
| [`packages/evaluation`](packages/evaluation)   | Confusion matrix, precision/recall/F1, FPR/FNR, ROC/AUC, base-rate                                             |
| [`packages/server`](packages/server)           | Express live monitor that ingests simulated requests                                                           |
| [`packages/experiments`](packages/experiments) | Multi-seed experiment runner (Node only): thresholds at a target FPR, intervals, results with provenance       |
| [`packages/dashboard`](packages/dashboard)     | Multi-page, SIEM-style console (Vite) — events, rules, models, detection quality; static build on GitHub Pages |

## Quick start

```bash
npm install          # from the repo root — sets up all workspaces
npm run team-setup   # once per computer: private e-mail, noreply commits (team guide)
npm test             # run the test suite (node:test)
npm run dev          # start the dashboard (Vite dev server)
npm run dev:server   # start the Express monitor (separate terminal)
npm run build        # static build of the dashboard (for GitHub Pages)
npm run experiments  # the 20-seed experiment → results/ (about 1.5 minutes)
```

Requires **Node.js ≥ 22**.

## Documentation

- [`AGENTS.md`](AGENTS.md) — contributor & agent manual (start here)
- [`docs/project-brief.md`](docs/project-brief.md) — the assignment (defines scope)
- [`docs/development/`](docs/development/README.md) — standards, structure, tech stack, ADRs
- [`docs/statistics/methods.md`](docs/statistics/methods.md) — the maths (entropy, chi-square,
  length bounds, outliers, ROC/AUC, confidence intervals on the metrics, base-rate / Bayes)
- [`docs/planning/backlog.md`](docs/planning/backlog.md) — task board (who does what)
- [`docs/guides/team-guide.md`](docs/guides/team-guide.md) — team guide: access, workflow, showing the demo in a portfolio

## Status

Work in progress. Implemented and tested: the dataset contract (train / calibration / test,
attacks injected into legitimate requests, variants), the generated traffic and attack families
(T4), a baseline detector, and the evaluation (T3): thresholds calibrated at a target FPR, ROC/AUC,
confidence intervals and the 20-seed experiment (`npm run experiments`). Still open: the
chi-square score (T1) and the length and outlier models (T2), as specified in the backlog.
Methodology decisions: ADR-006 – ADR-009.

## Reference

Kruegel & Vigna, _Anomaly Detection of Web-based Attacks_, ACM CCS 2003 — the
character-distribution / chi-square idea this project builds on.

## License

MIT — see [`LICENSE`](LICENSE).
