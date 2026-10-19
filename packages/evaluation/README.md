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
  rocCurve, // stub: D-03
} from '@anomaly-guard/evaluation';
```

## Use

```js
const r = evaluateAt(scoredSamples, 3); // predict "attack" when score ≥ 3
// r.confusion = { tp, fp, tn, fn }; r.precision, r.recall, r.f1, r.fpr, r.fnr, ...

// Base-rate fallacy: a "good" detector still mostly false-alarms when attacks are rare.
positivePredictiveValue(0.99, 0.01, 0.001); // ≈ 0.09
```

**Always report** the confusion matrix and both FPR and FNR — never accuracy alone, because the
classes are imbalanced (standards §3).

## Status

Implemented: confusion matrix, precision/recall/F1/FPR/FNR, single-threshold evaluation, and the
base-rate PPV helper. Stub: `rocCurve` + AUC (the threshold sweep — backlog D-03).

## Test

```bash
npm test --workspace @anomaly-guard/evaluation
```
