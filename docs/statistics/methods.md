# Statistical methods

The methods behind the detector, with just enough maths to implement and defend them. Each maps
to a function in `packages/core/src/stats` or `packages/evaluation`. Cite Kruegel & Vigna,
_Anomaly Detection of Web-based Attacks_ (CCS 2003) for the character-distribution idea.

## 0. Conventions

- **Alphabet / binning.** Character-distribution features use a fixed, documented set of
  character classes rather than 256 raw bytes, so counts stay stable and expected counts stay
  large enough for the chi-square test. Default classes: lowercase `a–z`, uppercase `A–Z`, digits
  `0–9`, space, and a set of "special" characters that matter for injection
  (`' " ; < > ( ) = - / \ % & | $ { }`), with everything else in `other`. The exact set lives in
  `core` as `DEFAULT_ALPHABET` and must not change silently.
- **Train vs. test.** Every model is fitted on legitimate traffic only; the test set is held out
  (ADR-004).
- **Score, not verdict.** Each function returns a number (and a p-value where relevant); the
  threshold is applied by the caller.

## 1. Shannon entropy — `stats/entropy.js` (implemented)

For a string over symbols with probabilities `p_i` (relative frequencies),

```
H = - Σ p_i · log2(p_i)      bits/symbol,   0 ≤ H ≤ log2(k)
```

where `k` is the number of distinct symbols. High `H` ≈ uniform/random-looking (encrypted,
encoded, random tokens); low `H` ≈ repetitive. Entropy alone does **not** separate attacks from
normal text well — it is one feature among many, and a good illustration of why we need several.

**Known-answer test:** a string using `k` symbols each equally often has `H = log2(k)` (e.g.
`"0101..."` → 1 bit).

## 2. Feature extraction — `features/extract.js`

Each request becomes a flat numeric record: total length, per-parameter length, parameter count,
counts (and ratios) per character class, byte/char histogram, Shannon entropy, HTTP method
(encoded), and an encoding flag (`%xx` present). Downstream code consumes this record only.

## 3. Confidence interval on length — `stats/anomaly.js` (stub C-04)

From legitimate traffic, estimate the mean `μ` and standard deviation `σ` of a parameter's
length. Flag a request whose length falls outside

```
μ ± z · σ        (e.g. z = 3 ≈ 99.7% for a roughly normal quantity)
```

Report the per-parameter **z-score** `(x − μ)/σ` as the anomaly score (caller thresholds it).
Lengths are often right-skewed, so consider a log transform or the robust version (§5). Example:
a search `q` that is normally 10–30 chars arriving at 800 is far outside the interval.

## 4. Chi-square test on the character distribution — `stats/anomaly.js` (stub C-03)

The heart of the project (Kruegel & Vigna 2003). Learn the **expected** relative frequency of
each character class from legitimate traffic. For a new string with observed counts `O_i` and
expected counts `E_i = N · p_i` (N = string length):

```
χ² = Σ (O_i − E_i)² / E_i          df = (#classes − 1)
```

A SQL injection has far more `'`, `=`, `-`, `(` than normal text, so `O_i` diverges from `E_i`,
`χ²` is large and the p-value small → anomaly. The function returns `{ chiSquare, df, pValue }`;
the caller thresholds the p-value.

**Must-dos (standards §3):**

- **Low expected counts** make the statistic unreliable: merge rare classes or require
  `E_i ≥ 5`; otherwise the test is not reported.
- With few classes, apply a continuity (Yates) correction where appropriate; state `df`.
- The p-value comes from the chi-square survival function at `df`; implement or tabulate it (no
  external stats lib in `core` — tech-stack §3).

## 5. Outlier detection — `stats/anomaly.js` (stub C-05)

Per-feature, robust alternatives to §3:

- **z-score:** `(x − μ)/σ` — simple, but `μ`/`σ` are themselves sensitive to outliers.
- **IQR / box-plot:** flag `x < Q1 − 1.5·IQR` or `x > Q3 + 1.5·IQR`.
- **MAD (robust):** `MAD = median(|x − median(x)|)`; robust score `0.6745 · (x − median)/MAD`.

**Multivariate — Mahalanobis distance:** across several features with covariance `S`,

```
D²(x) = (x − μ)ᵀ · S⁻¹ · (x − μ)
```

`D²` is approximately chi-square distributed with `df = #features`, giving a principled
threshold. Use it when single features overlap but the _combination_ is unusual.

## 6. Evaluation — `packages/evaluation` (metrics implemented; ROC/AUC stub D-03)

From a labelled test set and scores, at a threshold `t` (predict "attack" when `score ≥ t`):

```
confusion matrix:            metrics:
                 pred +  pred −      Precision = TP / (TP + FP)
    actual +      TP      FN         Recall/TPR = TP / (TP + FN)      → FNR = 1 − Recall
    actual −      FP      TN         Specificity = TN / (TN + FP)     → FPR = 1 − Specificity
                                     F1 = 2·P·R / (P + R)
```

- **ROC / AUC:** sweep `t` over all scores, plot TPR vs. FPR; AUC is the area under it (and the
  probability that a random attack scores above a random legit request). This is the
  threshold-independent summary the brief wants (D-03).
- Always show the confusion matrix and both error rates, never accuracy alone (standards §3).

## 7. Base-rate fallacy — `positivePredictiveValue` (implemented)

If attacks are a fraction `prevalence` of traffic, then even a good detector produces mostly
false alarms when attacks are rare. By Bayes:

```
PPV = P(attack | alarm)
    = (TPR · prevalence) / ( TPR · prevalence + FPR · (1 − prevalence) )
```

Worked example: `TPR = 0.99`, `FPR = 0.01`, `prevalence = 0.001` →

```
PPV = (0.99 · 0.001) / (0.99 · 0.001 + 0.01 · 0.999)
    ≈ 0.00099 / (0.00099 + 0.00999)
    ≈ 0.09   → only ~9% of alarms are real attacks.
```

This is the central lesson for the report: a 1% false-positive rate is "good" by ROC yet
produces ~10 false alarms per true attack at a 0.1% base rate. It motivates tuning the threshold,
combining rules with statistics, and reporting FP/FN honestly.
