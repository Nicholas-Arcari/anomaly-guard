# The Anomaly Guard

> Educational Intrusion Detection System — Project 5, master's course (extra-credit).
> Italiano: [`README.it.md`](README.it.md).

The Anomaly Guard monitors **simulated** web requests and decides, for each one, whether it is
normal or suspicious. It combines a classic **rule engine** (regex / keyword signatures) with
**statistical anomaly detection** (learn what normal traffic looks like, then flag what departs
from it), and then measures — honestly — how often each approach is right and wrong.

**Research question:** how much can statistics catch _without_ pre-defined attack signatures,
and at what cost in false positives and false negatives?

This is an **experiment**, not a production IDS. All traffic is synthetic and local — nothing is
captured from a real network, and no payload is ever executed or sent anywhere. See the scope
boundaries in [`CLAUDE.md`](CLAUDE.md) §2.

## What's inside

| Workspace                                    | What it does                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core)             | Feature extraction, rule engine, statistical models, detector (pure JS, runs in browser and Node) |
| [`packages/traffic`](packages/traffic)       | Seeded generator of legitimate + malicious requests, labelled dataset                             |
| [`packages/evaluation`](packages/evaluation) | Confusion matrix, precision/recall/F1, FPR/FNR, ROC/AUC, base-rate                                |
| [`packages/server`](packages/server)         | Express live monitor that ingests simulated requests                                              |
| [`packages/dashboard`](packages/dashboard)   | Browser UI (Vite) — verdicts, histograms, ROC; builds static for GitHub Pages                     |

## Quick start

```bash
npm install          # from the repo root — sets up all workspaces
npm test             # run the test suite (node:test)
npm run dev          # start the dashboard (Vite dev server)
npm run dev:server   # start the Express monitor (separate terminal)
npm run build        # static build of the dashboard (for GitHub Pages)
```

Requires **Node.js ≥ 22**.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — contributor & agent manual (start here)
- [`docs/project-brief.md`](docs/project-brief.md) — the assignment (defines scope)
- [`docs/development/`](docs/development/README.md) — standards, structure, tech stack, ADRs
- [`docs/statistics/methods.md`](docs/statistics/methods.md) — the maths (entropy, chi-square,
  confidence intervals, outliers, ROC/AUC, base-rate / Bayes)
- [`docs/planning/backlog.md`](docs/planning/backlog.md) — task board (who does what)

## Status

Early scaffold. The toolchain runs and the evaluation + entropy primitives are implemented and
tested; the pedagogically central pieces (chi-square test, confidence-interval model, outlier
methods, ROC sweep, the full detector, the rich traffic generator) are specified stubs with a
backlog task each — that is the group's work.

## Reference

Kruegel & Vigna, _Anomaly Detection of Web-based Attacks_, ACM CCS 2003 — the
character-distribution / chi-square idea this project builds on.

## License

MIT — see [`LICENSE`](LICENSE).
