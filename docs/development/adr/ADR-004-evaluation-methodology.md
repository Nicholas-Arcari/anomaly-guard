# ADR-004: Evaluation methodology

**Date:** 2026-10-19
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

The brief's core question is how well statistics detect attacks **without** signatures, measured
honestly by false positives and false negatives. The result is only meaningful if the
methodology is sound: it is very easy to produce an impressive-looking number by leaking labels,
fitting on the test set, or reporting accuracy on an imbalanced set.

## Decision

- **Train on normal only.** The statistical model is fitted on legitimate traffic alone. Attacks
  are never in the training set, and no label is used as a feature.
- **Held-out test set.** Evaluation uses a separate labelled split (legit + attacks, including
  **novel / obfuscated** attacks the rules do not cover). The split and the generator **seed** are
  recorded with every result.
- **Scores, then a swept threshold.** Detectors output scores/p-values; the decision threshold is
  applied by the evaluation harness, which sweeps it to produce the **ROC curve** and **AUC**.
- **Report the full picture.** Confusion matrix, **FPR and FNR** (not accuracy alone),
  precision/recall/F1, ROC/AUC. Compare three configurations: rules-only, stats-only, combined;
  and on known vs. novel attacks.
- **Base-rate analysis.** Report the positive predictive value at a realistic attack prevalence
  (Bayes), to show the base-rate fallacy — the headline of the discussion.
- **Hard cases.** Keep fixtures of legitimate-but-weird inputs (`O'Brien`, long free-text,
  non-Latin text) and stealthy attacks (`1 OR 1=1`, mimicry) and analyse where each method fails.

## Alternatives considered

| Alternative                             | Why rejected                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Single train/test on all data           | Label leakage; the model would "see" attacks it is meant to catch blind                                 |
| Report accuracy only                    | Meaningless under class imbalance; hides the FP/FN trade-off the brief asks for                         |
| Fixed threshold, single operating point | Loses the ROC; the threshold trade-off _is_ the result                                                  |
| k-fold cross-validation                 | Nice-to-have; a seeded single split is enough and simpler to report for this scope (can be added later) |

## Consequences

### Positive

- The numbers mean what they say; the report can defend them.
- Directly answers the brief (signatures vs. statistics, FP vs. FN, base rate).

### Negative / risks

- More plumbing (`evaluation` harness, threshold sweep). Mitigated: metrics + ROC/AUC +
  base-rate helpers live in `packages/evaluation` and are unit-tested.

### Actions

- [x] `confusionMatrix`, `metrics`, `positivePredictiveValue` implemented in `evaluation`.
- [ ] `rocCurve` + `auc` (threshold sweep) — backlog D-03.
- [ ] Experiment scripts that fix a seed and write `results/`.
