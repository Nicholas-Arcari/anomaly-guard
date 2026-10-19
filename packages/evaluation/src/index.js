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
 * probability that a random attack scores above a random legit sample.
 *
 * @param {Scored[]} scored
 * @returns {{ points: {fpr:number, tpr:number, threshold:number}[], auc:number }}
 */
// eslint-disable-next-line no-unused-vars
export function rocCurve(scored) {
  // TODO(D-03): implement the threshold sweep and trapezoidal AUC.
  throw new Error('rocCurve not implemented yet (backlog D-03)');
}
