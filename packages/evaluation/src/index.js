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
 * ROC curve and its area (D-03, methods.md §6): the threshold-free summary of a detector.
 *
 * The threshold sweeps down through the distinct scores. Each step flags one more group of tied
 * scores and adds the point (FPR, TPR) for "attack when score ≥ that score". The curve starts at
 * (0, 0), where nothing is flagged, and ends at (1, 1). A group that holds both attacks and
 * legitimate requests is one diagonal step, so ties get half credit. +Infinity (a rule hit in
 * `combined` mode, ADR-007) is simply the highest score.
 *
 * AUC is the trapezoid area under the points. It equals the Mann–Whitney statistic: the
 * probability that a random attack scores higher than a random legitimate request, ties counting
 * ½. With a binary score (`rules` mode, 0 or 1) the curve has one inner point, and
 * AUC = (1 + TPR − FPR) / 2.
 *
 * @param {Scored[]} scored  needs at least one attack and one legitimate sample
 * @returns {{ points: {fpr:number, tpr:number, threshold:number}[], auc:number }}
 *   points[0] is the origin (threshold +Infinity: nothing flagged, unless scores are +Infinity)
 */
export function rocCurve(scored) {
  const { positives, negatives } = countClasses(scored);
  const sorted = [...scored].sort((a, b) => descending(a.score, b.score));
  const points = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  let tp = 0;
  let fp = 0;
  for (let i = 0; i < sorted.length;) {
    const threshold = sorted[i].score;
    for (; i < sorted.length && sorted[i].score === threshold; i++) {
      if (sorted[i].label === 'attack') tp++;
      else fp++;
    }
    points.push({ fpr: fp / negatives, tpr: tp / positives, threshold });
  }
  let auc = 0;
  for (let j = 1; j < points.length; j++) {
    auc += ((points[j].fpr - points[j - 1].fpr) * (points[j].tpr + points[j - 1].tpr)) / 2;
  }
  return { points, auc };
}

/**
 * Validate scored samples and count the two classes.
 * @param {Scored[]} scored
 * @returns {{ positives: number, negatives: number }}
 */
function countClasses(scored) {
  if (!Array.isArray(scored)) throw new RangeError('expected an array of { label, score }');
  let positives = 0;
  let negatives = 0;
  for (const s of scored) {
    if (typeof s?.score !== 'number' || Number.isNaN(s.score)) {
      throw new RangeError('every sample needs a numeric score (+Infinity allowed, NaN not)');
    }
    if (s.label === 'attack') positives++;
    else if (s.label === 'legit') negatives++;
    else throw new RangeError(`unknown label '${s.label}': expected 'attack' or 'legit'`);
  }
  if (positives === 0 || negatives === 0) {
    throw new RangeError('needs at least one attack and one legitimate sample');
  }
  return { positives, negatives };
}

/** z for a two-sided 95% interval: the 97.5th percentile of the standard normal. */
export const Z_95 = 1.959963984540054;

/**
 * Wilson score interval for a proportion x/n (D-05, methods.md §6). This is how TPR, FPR, FNR and
 * precision get their uncertainty: they are proportions estimated from a finite test set.
 * Unlike the textbook Wald interval p̂ ± z·√(p̂(1−p̂)/n), it never collapses to a single point at
 * 0 or n and never leaves [0, 1]. So 0 false positives out of 900 gives FPR ∈ [0, 0.43%], not
 * "exactly zero".
 *
 * @param {number} successes  x, an integer in [0, n]
 * @param {number} n          number of trials, a positive integer
 * @param {{ z?: number }} [options]  z = Z_95 (1.96) for 95%
 * @returns {{ estimate: number, lower: number, upper: number, n: number }}
 */
export function wilsonInterval(successes, n, { z = Z_95 } = {}) {
  if (!Number.isInteger(n) || n <= 0)
    throw new RangeError('wilsonInterval: n must be a positive integer');
  if (!Number.isInteger(successes) || successes < 0 || successes > n) {
    throw new RangeError('wilsonInterval: successes must be an integer in [0, n]');
  }
  if (!(z > 0)) throw new RangeError('wilsonInterval: z must be positive');
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z / denominator) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    estimate: p,
    lower: successes === 0 ? 0 : Math.max(0, centre - half),
    upper: successes === n ? 1 : Math.min(1, centre + half),
    n,
  };
}

/**
 * Seeded, stratified percentile-bootstrap interval for the AUC (D-05, methods.md §6). It
 * resamples the attacks and the legitimate samples separately, with replacement, so that every
 * resample keeps the class counts of the test set. Each resample gets its AUC, and the interval is
 * the (1−level)/2 and (1+level)/2 percentiles of those AUCs. Reproducible: the caller passes the
 * random source, e.g. `createRng(seed).next` from `@anomaly-guard/traffic` (never Math.random).
 *
 * @param {Scored[]} scored
 * @param {{ random: () => number, resamples?: number, level?: number }} options
 *   random() returns a float in [0, 1); resamples defaults to 1000, level to 0.95
 * @returns {{ estimate: number, lower: number, upper: number, resamples: number, level: number }}
 */
export function bootstrapAucInterval(scored, { random, resamples = 1000, level = 0.95 } = {}) {
  if (typeof random !== 'function') {
    throw new RangeError('bootstrapAucInterval: pass a seeded random() function');
  }
  if (!Number.isInteger(resamples) || resamples < 1) {
    throw new RangeError('bootstrapAucInterval: resamples must be a positive integer');
  }
  if (!(level > 0 && level < 1))
    throw new RangeError('bootstrapAucInterval: level must be in (0, 1)');
  countClasses(scored);
  const attacks = scored.filter((s) => s.label === 'attack');
  const legit = scored.filter((s) => s.label === 'legit');
  const draw = (pool) => Array.from(pool, () => pool[Math.floor(random() * pool.length)]);

  const aucs = Array.from(
    { length: resamples },
    () => rocCurve([...draw(attacks), ...draw(legit)]).auc,
  );
  aucs.sort((a, b) => a - b);
  return {
    estimate: rocCurve(scored).auc,
    lower: quantile(aucs, (1 - level) / 2),
    upper: quantile(aucs, (1 + level) / 2),
    resamples,
    level,
  };
}

/**
 * Quantile of an ascending array by linear interpolation between order statistics (the usual
 * "type 7" definition).
 * @param {number[]} sorted  ascending, non-empty
 * @param {number} q         in [0, 1]
 */
function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}

/**
 * Interval for the mean of per-seed values (D-04, methods.md §6): mean ± t·SD/√n, with Student's
 * t on n − 1 degrees of freedom. The seed is the independent unit of an experiment (ADR-009): each
 * seed has its own training data, model, threshold and test set. So this interval covers
 * everything that changes from one run to the next. A Wilson interval on counts pooled over seeds
 * would not: the requests of one seed share one threshold, so they are not independent trials,
 * and the pooled interval comes out too narrow.
 *
 * When every value is the same (say 100% of canonical attacks in every seed) the SD is 0 and so is
 * the width: report that as "in every seed", with the pooled count.
 *
 * @param {number[]} values  one finite value per seed, at least two
 * @param {{ level?: number, range?: [number, number] }} [options]
 *   level defaults to 0.95; `range` clips the interval to the parameter's range, e.g. [0, 1] for a
 *   rate, where the normal approximation can otherwise cross 0 or 1
 * @returns {{ estimate: number, lower: number, upper: number, n: number, sd: number,
 *   min: number, max: number, level: number }}  estimate is the mean, sd the sample SD (n − 1)
 */
export function meanInterval(values, { level = 0.95, range } = {}) {
  if (!Array.isArray(values) || values.length < 2) {
    throw new RangeError('meanInterval: needs at least two values');
  }
  if (values.some((v) => !Number.isFinite(v))) {
    throw new RangeError('meanInterval: values must be finite numbers');
  }
  if (!(level > 0 && level < 1)) throw new RangeError('meanInterval: level must be in (0, 1)');
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { estimate: min, lower: min, upper: min, n, sd: 0, min, max, level };
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1));
  const half = (studentTQuantile((1 + level) / 2, n - 1) * sd) / Math.sqrt(n);
  const [low, high] = range ?? [-Infinity, Infinity];
  return {
    estimate: mean,
    lower: Math.max(low, mean - half),
    upper: Math.min(high, mean + half),
    n,
    sd,
    min,
    max,
    level,
  };
}

/**
 * Quantile of Student's t distribution: the t with P(T ≤ t) = p for `df` degrees of freedom, e.g.
 * studentTQuantile(0.975, 19) ≈ 2.093. Found by bisection on the distribution function, which is
 * computed from the regularized incomplete beta function: P(T > t) = ½·I_{df/(df+t²)}(df/2, ½)
 * for t ≥ 0.
 *
 * @param {number} p   probability in (0, 1)
 * @param {number} df  degrees of freedom, a positive number (≤ 1e6)
 * @returns {number}
 */
export function studentTQuantile(p, df) {
  if (!(p > 0 && p < 1)) throw new RangeError('studentTQuantile: p must be in (0, 1)');
  if (!(df > 0 && df <= 1e6)) throw new RangeError('studentTQuantile: df must be in (0, 1e6]');
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  if (p === 0.5) return 0;
  const tail = 1 - p; // find t with P(T > t) = tail; that probability falls as t grows
  const upperTail = (t) => 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  let lo = 0;
  let hi = 1;
  while (upperTail(hi) > tail) {
    lo = hi;
    hi *= 2;
  }
  for (let i = 0; i < 200 && hi - lo > 1e-13 * hi; i++) {
    const mid = (lo + hi) / 2;
    if (upperTail(mid) > tail) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Regularized incomplete beta function I_x(a, b), from its continued fraction (Numerical Recipes
 * §6.4). It gives the tails of Student's t here; the exact binomial test can use it too.
 * @param {number} x  in [0, 1]
 * @param {number} a  > 0
 * @param {number} b  > 0
 */
function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
  );
  // The fraction converges quickly for x < (a + 1)/(a + b + 2); use the symmetry otherwise.
  if (x < (a + 1) / (a + b + 2)) return (front * betaFraction(x, a, b)) / a;
  return 1 - (front * betaFraction(1 - x, b, a)) / b;
}

/** Continued fraction for I_x(a, b), evaluated with the modified Lentz method. */
function betaFraction(x, a, b) {
  const TINY = 1e-300;
  const guard = (v) => (Math.abs(v) < TINY ? TINY : v);
  let c = 1;
  let d = 1 / guard(1 - ((a + b) * x) / (a + 1));
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    const even = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 / guard(1 + even * d);
    c = guard(1 + even / c);
    h *= d * c;
    const odd = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 / guard(1 + odd * d);
    c = guard(1 + odd / c);
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-15) return h;
  }
  throw new Error('regularizedBeta: the continued fraction did not converge');
}

/**
 * ln Γ(x) for x ≥ 0.5, by the Lanczos approximation (g = 7, nine coefficients): about 15 correct
 * digits.
 * @param {number} x
 */
function logGamma(x) {
  const g = 7;
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const z = x - 1;
  let sum = coefficients[0];
  for (let i = 1; i < coefficients.length; i++) sum += coefficients[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}
