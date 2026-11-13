// Evaluation harness. Operates on plain data ({ label, score } / predictions), so it can score
// any detector without depending on core. See docs/statistics/methods.md §6–§7. Pure.
//
// Positive class = 'attack'. Predict "attack" when score ≥ threshold.

/** @typedef {{ label: 'attack'|'legit', score: number }} Scored */
/** @typedef {{ tp:number, fp:number, tn:number, fn:number }} Confusion */

/**
 * Confusion matrix from boolean predictions and truth.
 * @param {boolean[]} predictedAttack  predicted "attack" per sample
 * @param {boolean[]} actualAttack     true "attack" per sample
 * @returns {Confusion}
 */
export function confusionMatrix(predictedAttack, actualAttack) {
  if (predictedAttack.length !== actualAttack.length) {
    throw new Error('confusionMatrix: arrays must be the same length');
  }
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (let i = 0; i < actualAttack.length; i++) {
    const p = predictedAttack[i];
    const a = actualAttack[i];
    if (a && p) tp++;
    else if (a && !p) fn++;
    else if (!a && p) fp++;
    else tn++;
  }
  return { tp, fp, tn, fn };
}

/**
 * Standard metrics from a confusion matrix. Always report FPR and FNR, not accuracy alone
 * (standards §3): under class imbalance accuracy is misleading.
 * @param {Confusion} cm
 * @returns {{precision:number,recall:number,f1:number,fpr:number,fnr:number,specificity:number,accuracy:number}}
 */
export function metrics({ tp, fp, tn, fn }) {
  const safe = (num, den) => (den === 0 ? 0 : num / den);
  const precision = safe(tp, tp + fp);
  const recall = safe(tp, tp + fn); // = TPR = sensitivity
  const specificity = safe(tn, tn + fp);
  return {
    precision,
    recall,
    f1: safe(2 * precision * recall, precision + recall),
    fpr: safe(fp, fp + tn), // 1 − specificity
    fnr: safe(fn, fn + tp), // 1 − recall
    specificity,
    accuracy: safe(tp + tn, tp + fp + tn + fn),
  };
}

/**
 * Evaluate scored samples at a single threshold.
 * @param {Scored[]} scored
 * @param {number} threshold  predict "attack" when score ≥ threshold
 * @returns {{ confusion: Confusion } & ReturnType<typeof metrics>}
 */
export function evaluateAt(scored, threshold) {
  const predicted = scored.map((s) => s.score >= threshold);
  const actual = scored.map((s) => s.label === 'attack');
  const confusion = confusionMatrix(predicted, actual);
  return { confusion, ...metrics(confusion) };
}

/**
 * The decision threshold for a target false-positive rate, chosen on LEGITIMATE calibration
 * scores only (ADR-009, methods.md §6). With n scores and target α, at most k = ⌊α·n⌋ of them may
 * reach the threshold. The threshold is the smallest number strictly above the (k+1)-th largest
 * score, so "attack when score ≥ threshold" flags at most k calibration requests. Tied scores move
 * together: a tie that would exceed k stays below the threshold, so the calibration FPR can fall
 * below α.
 *
 * In `combined` mode a legitimate request that matches a rule scores +Infinity (ADR-007) and is
 * flagged at any threshold. If there are more than k of them, the target cannot be met: the
 * threshold then sits just above the largest finite score (so the statistics flag none of the
 * calibration requests) and `attainable` is false.
 *
 * The estimate rests on the k largest scores, and with fewer than about 10 of them it is very
 * noisy. So use n ≥ 10/α: 1,000 calibration requests for 1%, 10,000 for 0.1%.
 *
 * @param {number[]} legitScores  scores of the legitimate calibration requests (never the test set)
 * @param {number} targetFpr      α in [0, 1]
 * @returns {{ threshold: number, calibrationFpr: number, attainable: boolean, n: number }}
 *   `threshold` is always finite (core `detect` requires it); `calibrationFpr` is the share of
 *   calibration scores ≥ threshold.
 */
export function thresholdAtFpr(legitScores, targetFpr) {
  if (!Array.isArray(legitScores) || legitScores.length === 0) {
    throw new RangeError('thresholdAtFpr: needs at least one calibration score');
  }
  if (!(targetFpr >= 0 && targetFpr <= 1)) {
    throw new RangeError('thresholdAtFpr: targetFpr must be a number in [0, 1]');
  }
  if (legitScores.some((s) => typeof s !== 'number' || Number.isNaN(s))) {
    throw new RangeError('thresholdAtFpr: scores must be numbers (+Infinity allowed, NaN not)');
  }
  const n = legitScores.length;
  // ⌊α·n⌋ with a small tolerance, so that 0.29 · 100 = 28.999999999999996 still allows 29.
  const k = Math.floor(targetFpr * n + 1e-9);
  const sorted = [...legitScores].sort(descending);

  let threshold = k >= n ? sorted[n - 1] : nextUp(sorted[k]);
  if (!Number.isFinite(threshold)) {
    const largestFinite = sorted.find(Number.isFinite);
    threshold = largestFinite === undefined ? Number.MAX_VALUE : nextUp(largestFinite);
  }
  const flagged = sorted.filter((s) => s >= threshold).length;
  return { threshold, calibrationFpr: flagged / n, attainable: flagged <= k, n };
}

/** Sort comparator: descending, with equal infinities kept equal (∞ − ∞ is NaN). */
function descending(a, b) {
  return a === b ? 0 : b - a;
}

/**
 * The smallest double strictly greater than x (x itself for +Infinity and NaN).
 * @param {number} x
 * @returns {number}
 */
function nextUp(x) {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE; // also for -0
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

/**
 * Positive predictive value P(attack | alarm) by Bayes, for a given operating point and base
 * rate — the base-rate fallacy (methods.md §7). Rare attacks ⇒ mostly false alarms even when
 * TPR is high and FPR is low.
 * @param {number} tpr          true positive rate (sensitivity), 0..1
 * @param {number} fpr          false positive rate, 0..1
 * @param {number} prevalence   fraction of traffic that is attacks, 0..1
 * @returns {number} PPV in 0..1
 */
export function positivePredictiveValue(tpr, fpr, prevalence) {
  const alarmsTrue = tpr * prevalence;
  const alarmsFalse = fpr * (1 - prevalence);
  const alarms = alarmsTrue + alarmsFalse;
  return alarms === 0 ? 0 : alarmsTrue / alarms;
}

/**
 * ROC curve: sweep the threshold over the observed scores and return (fpr, tpr) points, with
 * the area under the curve. Threshold-independent summary the brief asks for (D-03).
 *
 * Implementation notes: sort by score descending, step the threshold through the unique scores,
 * accumulate TP/FP, and integrate with the trapezoid rule for AUC. AUC also equals the
 * probability that a random attack scores above a random legit sample. Scores may be +Infinity
 * (a rule hit in combined mode, ADR-007) and may tie: treat tied scores as one step.
 *
 * @param {Scored[]} scored
 * @returns {{ points: {fpr:number, tpr:number, threshold:number}[], auc:number }}
 */
// eslint-disable-next-line no-unused-vars
export function rocCurve(scored) {
  // TODO(D-03): implement the threshold sweep and trapezoidal AUC.
  throw new Error('rocCurve not implemented yet (backlog D-03)');
}
