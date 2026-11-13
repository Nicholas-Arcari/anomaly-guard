# ADR-009: Threshold calibration, repeated seeds and confidence intervals

**Date:** 2026-11-08
**Status:** Accepted — refines ADR-004
**Author:** The Anomaly Guard team

## Context

ADR-004 fixes training on normal traffic only, a held-out test set and a threshold sweep (ROC). It
leaves open how the _operating_ threshold behind a reported confusion matrix is chosen. Choosing it
by looking at test results (e.g. "the threshold with the best F1 on the test set") is selection on
the test set and inflates every number. A single seed hides how much the results vary. Point
estimates without intervals overstate precision: 0 false positives out of 900 is not "an FPR of
zero".

## Decision

1. **Three splits from one seed** (`buildDataset`): `train` (legitimate only) fits the model;
   `calibration` (legitimate only, never used for fitting) fixes the threshold; `test`
   (legitimate + attacks) is scored once, with that threshold.
2. **Threshold at a target FPR.** Score the calibration requests; the threshold is the smallest
   value that at most a fraction `targetFpr` of calibration scores reach (D-06,
   `thresholdAtFpr`). Report at `targetFpr` = 1%, and 0.1% for the base-rate discussion. No attack
   label is used to choose the threshold — Kruegel & Vigna likewise set thresholds on attack-free
   traffic.
3. **ROC and AUC** stay threshold-free summaries on the test set (ADR-004).
4. **Repeated seeds.** Every reported configuration runs on at least 20 seeds; report the mean and
   the spread.
5. **Confidence intervals on the metrics** — this is where the brief's "confidence intervals"
   belong (D-05): Wilson score interval for TPR, FPR, FNR and precision; seeded bootstrap
   percentile interval for AUC.
6. **Provenance.** Every result records the seed(s), git commit, split sizes, prevalence and
   target FPR (or "threshold-swept").
7. **Where experiments run.** A Node-only workspace `packages/experiments`, created in D-04, which
   may use `fs` and write to `results/`. `core`, `traffic` and `evaluation` stay pure (ADR-003).

## Alternatives considered

| Alternative                            | Why rejected                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Best threshold on the test set         | Selection on the test set: optimistic bias                                                                                                        |
| Labelled validation split with attacks | Uses attack labels to set the threshold and assumes the validation attacks represent the unknown ones; the legitimate-only quantile needs neither |
| A single seed                          | Hides variance; with generated data, more seeds cost nothing                                                                                      |
| k-fold cross-validation                | Unnecessary when fresh data is free to generate                                                                                                   |

## Consequences

### Positive

- The reported FPR is a genuine out-of-sample check of the target, and the FNR is honest.
- Results come with their uncertainty, which is what an applied-statistics report should show.

### Negative / risks

- More plumbing: D-06 (`thresholdAtFpr`), D-05 (intervals), D-04 (multi-seed runner).
- A 1% target needs at least ~1000 calibration requests, or the quantile is too noisy.

### Actions

- [x] `buildDataset` returns a `calibration` split.
- [x] D-06 `thresholdAtFpr`; D-05 intervals; D-04 runner in `packages/experiments`; B-02 server
      threshold from calibration.
- [ ] E-06 target-FPR control in the dashboard.
