# T3 — Evaluation and uncertainty

> **Draft** of the T3 chapter of the final report (E-05). Author: Nicholas Arcari.
>
> - **Source of the numbers:** one run of `npm run experiments` at commit `c4ef25c`, seeds 1–20,
>   clean working tree, 2026-11-13.
> - **The statistical score is still the baseline:** the length signal only. When the chi-square
>   and outlier signals land (C-03, C-05, C-06), re-run the experiment on the final commit and
>   update the tables.
>
> The Italian version is [`t3-evaluation-and-uncertainty.it.md`](t3-evaluation-and-uncertainty.it.md).

## 1. The question

The project asks how much statistics can catch without predefined signatures, and how often it
gets it wrong. This chapter measures the errors, and how sure we can be of those measurements. It
compares three detectors on the same requests:

- **rules**: signatures only. A request is flagged when a regular expression matches.
- **stats**: statistics only. A request is flagged when its anomaly score `s = −log10 p`, learned
  from legitimate traffic, reaches a threshold.
- **combined**: a request is flagged on a rule match, or when the score reaches the threshold.

## 2. Experimental design

Each **seed** draws a complete dataset from the traffic generator (T4, ADR-006), in three splits:

| Split       | Requests | Content                                           | Used for                      |
| ----------- | -------- | ------------------------------------------------- | ----------------------------- |
| train       | 2,000    | legitimate only                                   | fitting the statistical model |
| calibration | 10,000   | legitimate only                                   | choosing the threshold        |
| test        | 5,000    | 4,500 legitimate (225 hard cases) and 500 attacks | measuring the errors, once    |

- **Labels never reach the model or the threshold.** The model is fitted on legitimate requests
  only (ADR-004), and the threshold is chosen on legitimate requests only (ADR-009). Attack labels
  are used once, to score the test split. Choosing the threshold that looks best on the test set
  would inflate every number.
- **Attacks** are legitimate requests with one value replaced by a payload. They come in three
  variants:
  - canonical: known signatures;
  - obfuscated: disguised to dodge the signatures;
  - novel: families the rules have no signature for.

  Five of the nine families are novel, so novel attacks are more than half of the attacks: 258–296
  of the 500 in each seed.

- **Hard cases** are legitimate requests that look odd: an apostrophe, long free text, non-Latin
  text. They are only in the test split, so they show how the detector handles traffic the
  calibration never saw.
- **20 seeds** give 20 independent replications of the whole procedure: new data, new model, new
  thresholds.

## 3. Methods

### 3.1 Error rates, not accuracy

From the confusion matrix (TP, FN, FP, TN) the chapter reports:

- the true-positive rate, `TPR = TP / (TP + FN)` (recall), and its complement the false-negative
  rate, `FNR = 1 − TPR`;
- the false-positive rate, `FPR = FP / (FP + TN)`;
- the precision, `TP / (TP + FP)`.

Accuracy is not reported. With 90% legitimate requests, a detector that never raises an alert
would score 90%.

### 3.2 A threshold for a target false-positive rate

Take the scores of `n` legitimate calibration requests and a target `α`. At most `k = ⌊α·n⌋` of
them may reach the threshold. The threshold `t` is the smallest number strictly above the
`(k+1)`-th largest score: an empirical quantile of the legitimate scores (`thresholdAtFpr`).

- **Ties** move together, so the calibration FPR can fall below `α`.
- **Size:** the quantile rests on the `k` largest scores, and with fewer than about 10 of them it is
  noisy. So the calibration split has 10,000 requests: `n ≥ 10/α` even at `α = 0.1%`.
- **An unattainable target:** in combined mode a rule match scores `+∞` and is flagged at any
  threshold. If more than `k` legitimate calibration requests match a rule, no threshold meets the
  target. The threshold then sits above every finite calibration score, and only the rules fire on
  the calibration split.

Kruegel and Vigna (2003) likewise set their thresholds on attack-free traffic.

### 3.3 ROC curve and AUC

The ROC curve sweeps the threshold down through every distinct score and plots TPR against FPR.
The area under it is the Mann–Whitney statistic:

```
AUC = P(score of a random attack > score of a random legitimate request), ties counting ½
```

0.5 is chance and 1 is perfect separation. The AUC uses only the ranking of the scores, so it does
not depend on any threshold. The rules have a binary score: their curve has a single inner point,
and `AUC = (1 + TPR − FPR) / 2`.

### 3.4 Uncertainty within one run

Every rate is a proportion `x/n` estimated from a finite test set. It gets a 95% **Wilson**
interval, with `p̂ = x/n` and `z = 1.96`:

```
centre     = (p̂ + z²/(2n)) / (1 + z²/n)
half-width = z / (1 + z²/n) · √( p̂(1 − p̂)/n + z²/(4n²) )
```

The textbook Wald interval, `p̂ ± z·√(p̂(1 − p̂)/n)`, collapses to [0, 0] when there are no errors.
Wilson does not: 0 false positives out of 900 gives an FPR in [0, 0.43%], not "zero".

The AUC is not a simple proportion, so it gets a **stratified percentile bootstrap**:

1. resample the attacks and the legitimate requests separately, with replacement, 1,000 times;
2. compute the AUC of each resample;
3. take the 2.5th and 97.5th percentiles.

The random numbers come from a generator seeded with the dataset seed + 2³¹. That stream never
overlaps the dataset's, so the intervals are reproducible.

### 3.5 Uncertainty across runs

The intervals of §3.4 describe one test set. Across the 20 seeds everything changes at once:
training data, model, threshold and test set. Each metric is therefore summarised by its mean, its
standard deviation, its range, and a 95% Student-t interval for the mean:

```
mean ± t(0.975, 19) · SD / √20,     t(0.975, 19) = 2.093
```

The seed is the independent unit. The requests of one seed share one model and one threshold, so
they are not independent trials. A Wilson interval on the counts added up over all seeds would
ignore how much the threshold moves from run to run, and come out too narrow.

Sometimes a value is the same in every seed, for example 100% of command-injection attacks caught
by the rules. The interval then has zero width, and the tables say "every seed" instead.

### 3.6 Comparing two detectors on the same requests

The three detectors score the same requests, so their results are paired. **McNemar's test** uses
only the requests where two detectors disagree: `b` flagged by A only, `c` flagged by B only. If
the two were equally good, each disagreement would be a coin flip: `b ~ Binomial(b + c, ½)`.

- The exact two-sided p-value is `2·P(X ≤ min(b, c))`. The textbook χ² with continuity correction,
  `(|b − c| − 1)² / (b + c)`, agrees with it for large counts.
- Attacks, novel attacks and legitimate requests are tested separately. On attacks, flagging more is
  better; on legitimate requests, it means more false alarms. One test on all requests would compare
  accuracy.
- Over the seeds the counts are added up: under the null hypothesis each seed's `b` is binomial, and
  so is the sum.
- There are 18 tests (3 pairs × 3 groups × 2 targets). With a Bonferroni correction, a difference
  counts at p < 0.05/18 ≈ 0.0028.

## 4. Results

All values are the mean over 20 seeds, with the 95% t-interval of the mean in brackets.

### 4.1 Without a threshold: AUC

**Table 1 — AUC on the test split.**

| Detector | AUC                 | SD across seeds | Range       | Mean width of one seed's bootstrap interval |
| -------- | ------------------- | --------------- | ----------- | ------------------------------------------- |
| rules    | 0.700 [0.695–0.705] | 0.010           | 0.685–0.722 | 0.044                                       |
| stats    | 0.814 [0.801–0.827] | 0.028           | 0.763–0.856 | 0.051                                       |
| combined | 0.866 [0.858–0.875] | 0.018           | 0.827–0.893 | 0.043                                       |

On ranking alone, the combination separates attacks from legitimate requests best, and the
statistics clearly beat the rules.

### 4.2 At a 1% false-positive target

**Table 2 — Operating point at a 1% target.**

| Detector | Threshold           | Calibration FPR   | Test FPR, typical | Test FPR, all legitimate | TPR               | Precision         | Target met |
| -------- | ------------------- | ----------------- | ----------------- | ------------------------ | ----------------- | ----------------- | ---------- |
| rules    | — (a rule match)    | 3.10% [3.03–3.17] | 3.09% [2.96–3.22] | 2.93% [2.81–3.06]        | 42.9% [41.9–43.8] | 61.9% [60.7–63.2] | 0/20 seeds |
| stats    | 1.380 [1.325–1.435] | 0.95% [0.93–0.97] | 0.92% [0.82–1.02] | 2.53% [2.22–2.85]        | 57.2% [55.1–59.3] | 71.8% [69.2–74.4] | 20/20      |
| combined | 2.304 [2.229–2.380] | 3.10% [3.03–3.17] | 3.09% [2.96–3.23] | 2.94% [2.81–3.06]        | 66.2% [64.6–67.7] | 71.5% [70.4–72.5] | 0/20       |

**Table 3 — Share flagged by variant at a 1% target.** For attacks this is the detection rate;
for legitimate requests, the false-positive rate.

| Variant              | Requests per seed | rules             | stats             | combined          |
| -------------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| attack · canonical   | 163–197           | 95.7% [94.9–96.4] | 52.5% [50.3–54.6] | 96.5% [95.9–97.1] |
| attack · obfuscated  | 33–56             | 86.7% [83.8–89.6] | 63.7% [60.2–67.1] | 94.4% [92.6–96.1] |
| attack · novel       | 258–296           | 1.8% [1.5–2.1]    | 59.2% [56.7–61.7] | 42.1% [39.5–44.7] |
| legitimate · typical | 4,275             | 3.09% [2.96–3.22] | 0.92% [0.82–1.02] | 3.09% [2.96–3.23] |
| legitimate · hard    | 225               | 0% (every seed)   | 33.1% [26.9–39.4] | 0% (every seed)   |

By family:

- **The rules** catch every command-injection and traversal attack (100% in every seed), and most
  SQL injection (85.6%) and XSS (89.7%). Of each novel family they catch only about 2%.
- **The statistics** catch between 36% (command injection) and 84% (oversized values) of every
  family.
- **Legitimate requests:** all the rules' false alarms are on the login form. 20.6% [20.0–21.3] of
  login requests match a rule, because the generated passwords contain `#` and `--`.

### 4.3 At a 0.1% false-positive target

Only the statistics meet this target:

- threshold 1.917 [1.853–1.982];
- calibration FPR 0.08% [0.07–0.10], test FPR 0.08% [0.05–0.10];
- TPR down to 48.2% [45.7–50.8], precision up to 98.6% [98.3–99.0];
- 47.2% [44.1–50.3] of novel attacks caught, and no hard case flagged.

The rules and the combination cannot go below their 3% floor, so their rows are the same as at 1%.

### 4.4 Paired comparisons

**Table 4 — McNemar at a 1% target**, disagreements added up over the 20 seeds.

| A vs B            | Requests      | Flagged only by A | Flagged only by B | Exact p | Seeds with p < 0.05                    |
| ----------------- | ------------- | ----------------- | ----------------- | ------- | -------------------------------------- |
| stats vs combined | attacks       | 1,008             | 1,902             | < 0.001 | combined ahead in 19                   |
| stats vs combined | novel attacks | 975               | 27                | < 0.001 | stats ahead in 20                      |
| stats vs combined | legitimate    | 2,276             | 2,641             | < 0.001 | combined more alarms in 11, stats in 2 |
| rules vs stats    | attacks       | 1,902             | 3,335             | < 0.001 | stats ahead in 18                      |
| rules vs stats    | novel attacks | 27                | 3,207             | < 0.001 | stats ahead in 20                      |
| rules vs combined | legitimate    | 0                 | 4                 | 0.125   | none                                   |

The two detectors raise false alarms on different requests. Statistics alone raises 2,280 false
alarms and the combination 2,645, but only 4 of them are the same requests.

At 0.1% the picture is the same:

- statistics alone catches 340 novel attacks that the combination misses, against 60 the other way
  (p < 0.001);
- it raises 65 false alarms that the combination does not, against 2,641 the other way.

### 4.5 How much do the numbers move?

- **Rules:** the SD of the AUC across seeds (0.010) matches the standard error from one seed's
  bootstrap (≈ 0.044 / 3.92 = 0.011). The rules learn nothing from data, so the only noise is the
  test set.
- **Statistics:** the SD across seeds (0.028) is about twice the bootstrap's standard error
  (≈ 0.013). In variance terms the test set explains only about a fifth of it
  (0.013² / 0.028² ≈ 0.22). The rest comes from the training data, which a single run's interval
  cannot see.
- **The test FPR over all legitimate requests** also moves a lot: SD 0.68%, range 1.73–3.78%. How
  many of the four hard-case fixtures fall above the threshold changes from seed to seed.

This is why the experiment uses 20 seeds rather than one.

## 5. Discussion

1. **Calibration works where it has seen data.** On typical legitimate traffic, the statistics hit
   the targets out of sample: 0.92% [0.82–1.02] against 1%, and 0.08% against 0.1%.
2. **It does not cover what it has not seen.** One hard case in three (33%) raises a false alarm at
   the 1% target. Neither the calibration split nor the training split holds such requests: a
   model of "normal" is only as wide as the normal traffic it was given.
3. **Statistics catch what signatures cannot.** At 1% they catch 59% of novel attacks, against 2%
   for the rules: this is the core answer to the research question. But they also miss about half
   of the canonical attacks the rules catch (52% against 96%). So they complement the rules rather
   than replace them.
4. **Combining is not free.** The rules alone flag 3.1% of legitimate traffic, so the combination
   can never meet a 1% or 0.1% target.
   - So that the statistics add no false alarm of their own, the combination's threshold rises from
     1.38 to 2.30.
   - It therefore catches fewer novel attacks than the statistics alone: 42% against 59% (McNemar
     p < 0.001, in all 20 seeds).
   - Its higher AUC (0.866) hides this. AUC summarises every threshold, including a region the
     combination cannot reach: below an FPR of about 3% it has no operating point at all.

   Fixing the signatures that fire on passwords (`#`, `--`) is task B-01 of T1.

5. **The base rate changes everything** (T4's chapter). At the 10% prevalence of the test split,
   about 72% of the statistics' alarms are attacks. At a prevalence `π` of 0.1%, Bayes gives:

   ```
   PPV = TPR·π / (TPR·π + FPR·(1 − π))
   ```

   - at the 1% target: 2.2%, so 98 alarms in 100 are false;
   - at the 0.1% target: 37.6%.

## 6. Limitations

- **Synthetic data.** The numbers describe the T4 generator, not real traffic. The conclusions that
  carry over are comparative: rules against statistics, the cost of combining, calibration against
  unseen requests.
- **A baseline model.** The score is still the length signal alone. The chi-square and outlier
  signals (C-03, C-05, C-06) will change every number in Tables 1–4.
- **Four hard cases, repeated.** Their false-positive rate mostly says which of the four fall above
  the threshold. It is not a rate over a population of unusual requests.
- **The t-interval** assumes roughly normal per-seed values. With 20 seeds this is reasonable, but
  not near 0% or 100%, where the interval is clipped.
- **Many tests.** Only the McNemar results with p < 0.0028 survive a Bonferroni correction. In
  Table 4, every row but the last one does.

## 7. Reproducing the numbers

```bash
git checkout c4ef25c
npm ci
npm run experiments      # about 1.5 minutes; writes results/<date>-<commit>/report.md
```

The same seed always gives the same data, model, thresholds and bootstrap resamples.
`results.json` holds every seed, with its own Wilson and bootstrap intervals. The dashboard's
_Detection quality_ page shows one seed live: ROC, confusion matrix, variants, McNemar.

## 8. Individual contribution

Nicholas Arcari (T3) wrote:

- the threshold calibration (D-06);
- the ROC curve and AUC (D-03);
- the Wilson and bootstrap intervals (D-05);
- the multi-seed experiment and the across-seed intervals (D-04);
- the server calibration (B-02);
- the dashboard's _Detection quality_ page (E-06, and the ROC of E-02);
- McNemar's test (D-07);
- this chapter.

Prepared with Claude Code (AI assistant), as the team guide asks to declare.

## References

- C. Kruegel and G. Vigna, _Anomaly Detection of Web-based Attacks_, ACM CCS 2003.
- E. B. Wilson, _Probable inference, the law of succession, and statistical inference_, JASA 22,
  1927 (the Wilson interval).
- Q. McNemar, _Note on the sampling error of the difference between correlated proportions or
  percentages_, Psychometrika 12, 1947.
- J. A. Hanley and B. J. McNeil, _The meaning and use of the area under a receiver operating
  characteristic (ROC) curve_, Radiology 143, 1982 (AUC as the Mann–Whitney statistic).
- B. Efron and R. J. Tibshirani, _An Introduction to the Bootstrap_, Chapman & Hall, 1993.
