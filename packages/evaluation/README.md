# @anomaly-guard/evaluation

The evaluation harness. Works on plain `{ label, score }` data, so it can score any detector
without depending on `core`. Pure JS. The maths is in
[`../../docs/statistics/methods.md`](../../docs/statistics/methods.md) §6–§7.

## Exports

```js
import {
  confusionMatrix,
  metrics,
  evaluateAt,
  positivePredictiveValue, // base-rate / Bayes
  thresholdAtFpr, // threshold from legitimate calibration scores at a target FPR (D-06)
  rocCurve, // ROC points and AUC = Mann–Whitney (D-03)
} from '@anomaly-guard/evaluation';
```

## Use

```js
const r = evaluateAt(scoredSamples, 3); // predict "attack" when score ≥ 3
// r.confusion = { tp, fp, tn, fn }; r.precision, r.recall, r.f1, r.fpr, r.fnr, ...

// Base-rate fallacy: a "good" detector still mostly false-alarms when attacks are rare.
positivePredictiveValue(0.99, 0.01, 0.001); // ≈ 0.09

// The honest operating point (ADR-009): a threshold chosen on LEGITIMATE calibration scores only.
const { threshold, calibrationFpr, attainable } = thresholdAtFpr(calibrationScores, 0.01);
evaluateAt(testScored, threshold); // then score the test set once
```

**Always report** the confusion matrix and both FPR and FNR — never accuracy alone, because the
classes are imbalanced (standards §3).

Scores follow the common scale of ADR-007 (higher = more anomalous); in `combined` mode a rule hit
scores `+Infinity`, which every function here must handle.

## Status

Implemented: confusion matrix, precision/recall/F1/FPR/FNR, single-threshold evaluation, the
base-rate PPV helper, and `thresholdAtFpr`, the threshold from the legit-only calibration split at
a target FPR (D-06, ADR-009), and `rocCurve` with its AUC (D-03). Planned: confidence intervals on
the metrics (D-05: Wilson for rates, seeded bootstrap for AUC). The experiment runner that
uses all of this lives in a separate Node-only workspace, `packages/experiments` (D-04).

## Test

```bash
npm test --workspace @anomaly-guard/evaluation
```
