# ADR-007: Per-parameter models and a common score scale

**Date:** 2026-11-08
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

- The length signal produced a z-score (higher = more anomalous), the chi-square test produces a
  p-value (lower = more anomalous), the outlier methods produce yet other numbers. As they stood
  they could not be combined or thresholded together.
- The `combined` detector was a boolean OR of "a rule matched" and "statistical score ≥
  threshold", so it had no continuous score and therefore no ROC curve, which ADR-004 requires for
  every configuration.
- Models were keyed by parameter name only, pooling e.g. a `q` on `/search` with a `q` elsewhere.
  Kruegel & Vigna model each (program, attribute) pair separately.
- `μ ± 3σ` on lengths was called a "confidence interval". It is not one: a confidence interval
  bounds a _parameter_ (the mean) and shrinks as 1/√n, while flagging one _new value_ needs a bound
  on a new observation — a prediction interval or a tail inequality.

## Decision

1. **Per-(path, parameter) models.** Statistics are learned separately for each pair, keyed by
   `paramKey(path, name)`, e.g. `/search?q`. The character counts pooled over all values are kept
   as a fallback for sparse or unseen pairs (used by C-03). The policy for unseen pairs is decided
   in C-04 (length) and C-03 (characters).
2. **One scale: s = −log10(p).** Every statistical signal estimates the tail probability `p` of
   the observed value under the normal-traffic model and reports `s = −log10(p)`: 0 =
   unremarkable, 1 = p ≤ 0.1, 2 = p ≤ 0.01, 3 = p ≤ 0.001. Higher always means more anomalous, so
   one threshold and one ROC apply to every method.
3. **Length signal: Chebyshev bound** (C-04 baseline). With `z = |x − μ| / σ`, Chebyshev's
   inequality gives `P(|X − μ| ≥ zσ) ≤ 1/z²` for _any_ distribution, so `p = min(1, 1/z²)`. It
   needs no normality (lengths are skewed and bounded below by 0), it is what Kruegel & Vigna use
   for lengths, and it bounds a new observation. C-04 may compare it with a normal-theory
   prediction interval (methods.md §3).
4. **Combination.** The statistical score is the **maximum** of the signal scores; the arg-max is
   reported as the reason. The detector score depends on the mode:
   - `stats`: the statistical score;
   - `combined`: `+Infinity` when a rule matched, otherwise the statistical score;
   - `rules`: `1` if a rule matched, else `0` — a binary score, so its ROC is a single operating
     point.

   In `stats` and `combined` mode, `verdict === 'attack'` exactly when `score ≥ threshold`. The
   threshold is always passed explicitly (no default) and is calibrated on legitimate data
   (ADR-009).

## Alternatives considered

| Alternative                                  | Why rejected                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fisher's method, −2 Σ ln p ~ χ²(2k)          | Assumes independent signals; ours are computed on the same string and are correlated |
| Weighted sum of (1 − p) (Kruegel & Vigna)    | Needs weights; tuning them on labelled data would leak labels into the detector      |
| Keep raw z, χ² and p-values                  | Different scales and directions: no single threshold, no single ROC                  |
| Normal-theory interval μ ± zσ on raw lengths | Assumes normal lengths; ours are skewed. Kept only as a comparison in C-04           |
| Keep one model per parameter name            | Pools values with different meanings as soon as a name appears on two endpoints      |

## Consequences

### Positive

- Every configuration (rules, stats, combined) has a score the ROC can sweep.
- Explanations name the signal that fired and its tail probability.

### Negative / risks

- Chebyshev is conservative (p = 0.01 needs z = 10), so the length signal alone is weak. The
  threshold is calibrated empirically anyway (ADR-009).
- Taking the maximum raises the false-alarm rate as signals are added (more chances to be
  extreme); calibrating the threshold on legitimate data compensates.
- Per-pair models need enough training values per pair.

### Actions

- [x] `paramKey`, per-pair `StatModel`, `pToScore`, Chebyshev `lengthScore`, continuous detector
      score, explicit threshold.
- [ ] C-03 and C-05 return a tail probability; C-06 adds them to `scoreRequest`.
