# Statistical methods

The methods behind the detector, with just enough maths to implement and defend them. Each maps
to a function in `packages/core/src/stats` or `packages/evaluation`. Cite Kruegel & Vigna,
_Anomaly Detection of Web-based Attacks_ (CCS 2003) for the character-distribution and
length-bound ideas. Decisions behind this page: ADR-004, ADR-006 – ADR-009.

## 0. Conventions

- **Character classes (ADR-008).** Character-distribution features use a fixed set of seven
  classes rather than raw bytes. The exact set lives in `core` as `CHAR_CLASSES` and
  `SPECIAL_CHARS` (`stats/entropy.js`) and must not change without an ADR.

  | Class      | Characters                                                                                                           |
  | ---------- | -------------------------------------------------------------------------------------------------------------------- |
  | `lower`    | `a–z`                                                                                                                |
  | `upper`    | `A–Z`                                                                                                                |
  | `digit`    | `0–9`                                                                                                                |
  | `space`    | the space character (U+0020)                                                                                         |
  | `special`  | injection metacharacters ``' " ; < > ( ) = - / \ % & \| $ { } ` * #`` and control characters (U+0000–U+001F, U+007F) |
  | `punct`    | the other printable ASCII punctuation `! + , . : ? @ [ ] ^ _ ~`                                                      |
  | `nonascii` | any code point ≥ U+0080: accented letters, non-Latin scripts, emoji                                                  |

- **Per-(path, parameter) models (ADR-007).** Statistics are learned per pair, keyed
  `paramKey(path, name)` → e.g. `/search?q`, as Kruegel & Vigna model each (program, attribute).
- **Decoded values (ADR-006).** Parameter values are what the application sees after one
  URL-decoding pass; leftover `%xx` means double encoding.
- **Train vs. test.** Every model is fitted on legitimate traffic only; thresholds are set on a
  separate legitimate-only calibration split; the test set is held out (ADR-004, ADR-009).
- **One score scale (ADR-007).** Every statistical signal estimates the tail probability `p` of
  the observed value under the normal model and reports `s = −log10(p)`: 0 = unremarkable,
  1 = p ≤ 0.1, 2 = p ≤ 0.01, 3 = p ≤ 0.001. Higher is always more anomalous. The threshold is
  applied by the caller (`pToScore` in `stats/model.js`).

### Synthetic legitimate traffic (A-02)

This is an explicit **assumed**, not empirically fitted, model. It cannot establish realism for a
particular website. Each request independently selects one endpoint by a categorical draw:
`/search` 25%, `/products` 20%, `/cart` 15%, `/login` 15%, `/profile` 10%, and `/comments` 15%.
The method and parameters below are fixed by that endpoint, as in ADR-006. All draws use the
seeded generator, including in train, calibration and test.

| Endpoint    | Method | Parameter distributions                                                                                                           |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `/search`   | GET    | `q`: 1–4 words, uniformly selected count; `page`: geometric with p=0.35                                                           |
| `/products` | GET    | `id`: uniform integer 1–9999; `sort`: uniform among `popular`, `price`, `new`                                                     |
| `/cart`     | POST   | `id`: uniform integer 1–9999; `qty`: geometric with p=0.5                                                                         |
| `/login`    | POST   | `user`: uniform synthetic name; `pass`: uniform length 8–24, independent uniform characters from the documented password alphabet |
| `/profile`  | POST   | `email`: uniform synthetic local part at `example.com`; `bio`: generated text of log-normal length                                |
| `/comments` | POST   | `name`: uniform synthetic name; `body`: generated text of log-normal length                                                       |

The exact vocabulary, name and email pools, password alphabet and sentence templates are in
`packages/traffic/src/generators.js`. Search and text words are independent draws from a finite ranked vocabulary, with
`P(rank r) = (1/r) / Σ(1/j)`. Thus a few words recur often without removing rare words. Text
length is `min(4096, max(1, round(exp(log(100) + 1.2 Z))))`, where `Z` is standard normal
sampled using Box–Muller. The unrounded, unbounded distribution has median 100 and 90th
percentile approximately 466; rounding and the 4096 cap alter its extreme tail. Construct text
from sentence fragments, punctuation and occasional fixed contextual strings until the chosen
length, then truncate to that length in JavaScript UTF-16 code units. Each sentence selects one
of four fixed templates uniformly and inserts independently sampled words. Geometric draws use
`P(X=k)=p(1-p)^(k-1)`, k ≥ 1; their means are 1/p. Text and fields are synthetic and may include
accents and non-Latin characters; fixed URLs are data and are never requested. Values and weights
are chosen for varied examples, not inferred from user data. Changes to the generator change the
dataset even with the same seed, so record both seed and commit (ADR-009).

### Held-out legitimate hard cases (A-05)

`buildDataset` can add a fixed, synthetic fixture pool of unusual but legitimate requests to the
test split: apostrophes, non-Latin text, long free text and punctuation. Their `hard` variant
describes how they were selected, not a detector's verdict. They keep the same endpoint schemas as
the ordinary generator. The generator itself can still produce unusual inputs in any split; the
fixture pool is added only to test, never to training or calibration.

The optional `hardShare` (default 0, range 0–1) is the assumed share among **legitimate test**
requests. First take `attacks = round(testSize × prevalence)`, then
`hard = round((testSize − attacks) × hardShare)`; the remaining legitimate requests are generated
normally. For example, 100 tests at prevalence 0.1 and hardShare 0.1 contain 10 attacks, 9 hard
and 81 typical legitimate requests. The seeded generator samples each of the four fixtures with
equal probability 1/4, independently with replacement, and shuffles the test set. The actual
share can differ slightly due to rounding. Record `hardShare` along with the seed and commit.

This deliberately chosen share and the small hand-picked fixture pool are not estimates of real
traffic; repeated examples are not independent new cases. Report false positives separately for
hard and typical legitimate inputs and interpret the overall FPR in light of the chosen mixture.
The calibration threshold remains chosen on its separate legitimate-only split, without using test
results.

### Synthetic attacks (A-03, A-04)

An attack starts as a legitimate request; one uniformly chosen parameter value is replaced by a
payload (ADR-006). The generator picks uniformly among the nine nonempty families, then uniformly
among that family's entries. These are assumed sampling weights, not estimates of real attack
frequency. Each family has probability `1/9`; each of the twelve SQL examples has probability
`(1/9) · (1/12) = 1/108`. The canonical shares within SQL, XSS, traversal and command injection
are respectively `8/12`, `6/9`, `6/7` and `6/6`. The other five families are entirely novel,
so among attacks the expected variant shares are canonical `67/189`, obfuscated `17/189` and
novel `5/9`. Equal family weights do not imply equal variant or payload weights. These proportions
describe the generator, not detector accuracy or the prevalence of attacks in real traffic.

Obfuscated examples cover leftover percent escapes after the server's one decoding pass, embedded
comments, mixed case, tabs and newlines, string concatenation and HTML entities. These are labelled
by construction, even if a rule happens to catch one; syntax acceptance can vary by parser. Short
mimicry examples such as `1 OR 1=1` and `admin'--` are labelled `canonical` because they are
untransformed targeted-family examples. `mimicry` is not a separate ADR-006 variant. The novel
families are fixed in advance: oversized, template, LDAP, NoSQL and CRLF/header injection. They are
not defined by which samples the rules miss. These small, hand-picked pools test the experiment's
design; they do not represent the variety or frequency of attacks in the real world.

The canonical strings are public examples or small adaptations of examples from OWASP's
[SQL injection testing guide](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection/),
[XSS overview](https://community.owasp.org/attacks/xss/),
[XSS examples](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html),
[path traversal overview](https://community.owasp.org/attacks/Path_Traversal), and
[command injection overview](https://community.owasp.org/attacks/Command_Injection).
The additional examples and transformations follow or adapt public descriptions in OWASP's
[SQL filter bypass examples](https://community.owasp.org/attacks/SQL_Injection_Bypassing_WAF),
[XSS filter evasion examples](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html),
[template injection guide](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/18-Server-side_Template_Injection/),
[LDAP injection guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Injection_Testing/06-Testing_for_LDAP_Injection/),
[NoSQL security guide](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html), and
[HTTP response splitting guide](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/15-HTTP_Response_Splitting/).
They are synthetic measurement subjects, not real requests; no claim is made that this small,
hand-picked pool represents real-world attack frequencies or all possible attacks. A change to
the pool can change generated results for the same seed, so record the commit as well as the seed.

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

## 2. Feature extraction — `features/extract.js` (implemented)

Each request becomes a flat numeric record: total length, per-parameter length, parameter count,
character-class counts and ratios (the binned histogram of §0, per parameter and over the whole
payload), Shannon entropy, HTTP method (encoded), and an encoding flag (`%xx` still present after
decoding). Downstream code consumes this record only. The raw character histogram
(`charHistogram`) is used for the entropy, not as a feature.

## 3. Length model — `stats/length.js` (Chebyshev baseline implemented, C-04)

From legitimate traffic, estimate the mean `μ` and standard deviation `σ` of each pair's value
length. For a new value `x`, `z = |x − μ| / σ`. **Chebyshev's inequality** holds for any
distribution:

```
P(|X − μ| ≥ z·σ) ≤ 1 / z²      →   p = min(1, 1/z²),   s = −log10(p)
```

so a value 10 standard deviations away has `p ≤ 0.01` and score 2. It needs no normality, which
matters because lengths are right-skewed and bounded below by 0; it is the bound Kruegel & Vigna
use for lengths. Example: a search `q` that is normally 10–30 characters arriving at 800 is far
outside.

**This is not a confidence interval.** A confidence interval bounds a _parameter_ (here the mean
`μ`) and shrinks as `1/√n`. To judge one _new value_ we need a bound on a new observation: the
Chebyshev bound above or, if lengths were normal, the **prediction interval**

```
μ̂ ± t(n−1, 1−α/2) · s · √(1 + 1/n)
```

C-04 may compare the two (on raw and log-transformed lengths) and must decide how to treat pairs
never seen in training (Kruegel & Vigna treat an unexpected attribute as anomalous in itself).
Confidence intervals proper are used on the evaluation metrics (§6).

## 4. Chi-square score on the character distribution — `stats/chisquare.js` (stub, C-03)

The heart of the project (Kruegel & Vigna 2003, adapted in ADR-008). For one parameter value with
`N` characters, `O_i` is the observed count of class `i`. The expected probabilities come from the
pair's training counts `c_i` (total `C`, `k = 7` classes) with **Laplace smoothing**, so no
expected count is ever zero:

```
p̂_i = (c_i + 1) / (C + k)        E_i = N · p̂_i
χ²  = Σ (O_i − E_i)² / E_i        df = k − 1 = 6
```

A SQL injection has far more `'`, `=`, `-`, `(` than normal text, so `O_i` diverges from `E_i`
and `χ²` is large. If the pair is unseen, use the pooled counts (`model.classCounts`). Return the
most anomalous parameter: `{ chiSquare, df, pValue, score, param }`.

**It is a score, not a test.** On short strings the expected counts of the rare classes are far
below 5 (on the baseline data `E(special) ≈ 0.0035 · N`), so the asymptotic chi-square
distribution does not hold and the p-value is only **nominal**. We do not merge classes — the rare
classes _are_ the signal — and we do not apply Yates' correction (it is for `df = 1`). The p-value
is used through `s = −log10(p)`, which is monotone in `χ²`, and the threshold is calibrated on
legitimate data (§6), so the miscalibration does not bias the error rates. Do not present the
per-request p-value as a probability in the report.

**Survival function for df = 6** (no stats library in `core`): for an even `df = 2m`,

```
P(χ²(2m) > x) = e^(−x/2) · Σ_{j=0}^{m−1} (x/2)^j / j!
p(χ², df = 6) = e^(−x/2) · (1 + x/2 + x²/8)
```

Compute `ln p = −x/2 + ln(1 + x/2 + x²/8)` and `s = −ln p / ln 10`, so very large `χ²` values do
not underflow to `p = 0`. **Known answers:** `χ² = 12.592, df = 6 → p ≈ 0.05`;
`χ² = 16.812 → p ≈ 0.01`. Other `df` (for example after merging cells in §4b) need the general
regularised incomplete gamma function `Q(df/2, x/2)` (series and continued fraction).

### 4b. The formal test: legitimate vs attack traffic (C-08)

For the report, compare the class distribution of **all** legitimate test values with that of
**all** attack test values in a 7 × 2 contingency table (test of homogeneity, `df = (7 − 1)(2 − 1)
= 6`). Counts are in the thousands, so `E_i ≥ 5` holds and this is a valid test. If a cell still
falls below 5, merge that class with a neighbour **for this test only** and state it.

## 5. Outlier detection — `stats/outliers.js` (to create, C-05)

Per-feature, robust alternatives to §3. Each must end as a tail probability and a score on the
§0 scale:

- **z-score:** `(x − μ)/σ` — simple, but `μ`/`σ` are themselves sensitive to outliers.
- **IQR / box-plot:** flag `x < Q1 − 1.5·IQR` or `x > Q3 + 1.5·IQR`; as a score, use the distance
  beyond the fence in IQR units with a documented mapping to `p`.
- **MAD (robust):** `MAD = median(|x − median(x)|)`; robust score `0.6745 · (x − median)/MAD`,
  then a Chebyshev or normal tail as in §3.

**Multivariate — Mahalanobis distance:** across `d` features with covariance `S`,

```
D²(x) = (x − μ)ᵀ · S⁻¹ · (x − μ)      p ≈ P(χ²(d) > D²)
```

Use it when single features overlap but the _combination_ is unusual. Drop constant features or
regularise (`S + λI`) before inverting: on legitimate traffic some features never vary, which
makes `S` singular.

## 6. Evaluation — `packages/evaluation` (metrics implemented; D-03, D-05, D-06 stubs)

From a labelled test set and scores, at a threshold `t` (predict "attack" when `score ≥ t`):

```
confusion matrix:            metrics:
                 pred +  pred −      Precision = TP / (TP + FP)
    actual +      TP      FN         Recall/TPR = TP / (TP + FN)      → FNR = 1 − Recall
    actual −      FP      TN         Specificity = TN / (TN + FP)     → FPR = 1 − Specificity
                                     F1 = 2·P·R / (P + R)
```

- **Choosing `t` (ADR-009, D-06).** Never by looking at test results. Score the legitimate-only
  **calibration** split and take the smallest `t` that at most a fraction `targetFpr` of those
  scores reach (e.g. 1%: with 1000 calibration requests, about the 10th highest score). Then
  score the test set once with that `t`.
- **ROC / AUC (D-03):** sweep `t` over all scores, plot TPR vs. FPR; AUC is the area under it (and
  the probability that a random attack scores above a random legit request). In `combined` mode a
  rule hit scores `+Infinity`; in `rules` mode the score is binary, so its ROC is a single point.
- **Confidence intervals (D-05).** Error rates are proportions estimated from finite samples, so
  report them with a 95% **Wilson score interval** (`z = 1.96`, `p̂ = x/n`):

  ```
  centre = (p̂ + z²/(2n)) / (1 + z²/n)
  half   = z / (1 + z²/n) · √( p̂(1 − p̂)/n + z²/(4n²) )
  ```

  Example: 0 false positives out of 900 legitimate requests gives FPR ∈ [0, 0.43%], not "zero".
  For AUC use a seeded bootstrap (resample the test set, ~1000 times, 2.5th–97.5th percentile).

- **Repeated seeds (ADR-009).** Run every configuration on at least 20 seeds and report the mean
  and spread; record seeds, git commit, split sizes, prevalence and target FPR.
- Always show the confusion matrix and both error rates, never accuracy alone (standards §3), and
  break the results down by `variant` (canonical / obfuscated / novel attacks, typical / hard
  legitimate requests).

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
