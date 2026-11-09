# ADR-008: Character classes and the chi-square score on short strings

**Date:** 2026-11-08
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

`standards.md` §3, `methods.md` §4 and `CLAUDE.md` §7 required merging classes until every
expected count was `E_i ≥ 5`, and not reporting the test otherwise. On the baseline data the
expected share of `special` characters is about 0.35%: a value would need about 1400 characters to
reach `E ≥ 5`, and `upper` had `E = 0` (a division by zero). Merging the rare classes removes
exactly the signal the test exists for — an injection payload is anomalous _because_ of its rare
characters. Applied literally, the rule meant the test would almost never be reported.

Separately, the `other` class mixed injection-relevant punctuation (`` ` `` `*` `#`) with harmless
non-Latin letters, so a legitimate Greek comment and a shell payload looked alike.

## Decision

1. **Seven fixed classes** (`CHAR_CLASSES`, methods.md §0): `lower`, `upper`, `digit`, `space`,
   `special` (injection metacharacters ``' " ; < > ( ) = - / \ % & | $ { } ` * #`` plus control
   characters), `punct` (the other printable ASCII punctuation `! + , . : ? @ [ ] ^ _ ~`),
   `nonascii` (any code point ≥ U+0080). Changing them needs a new ADR.
2. **The per-request chi-square is an anomaly score, not a hypothesis test.** For each parameter
   value with `N` characters: observed counts `O_i`; expected `E_i = N · p̂_i` with
   Laplace-smoothed `p̂_i = (c_i + 1) / (C + k)` from the pair's training counts (the pooled counts
   if the pair is unseen), so `E_i > 0` always. `χ² = Σ (O_i − E_i)² / E_i`, `df = k − 1 = 6`, no
   class merging, no Yates correction (it only applies to `df = 1`). The p-value from the χ²(6)
   survival function is **nominal** — the asymptotic approximation does not hold for small `E_i` —
   and is used only through `s = −log10(p)` (ADR-007), which is monotone in χ². The threshold is
   calibrated empirically on legitimate data (ADR-009), so the miscalibration does not bias the
   reported error rates.
3. **The formal test lives at dataset level.** The report uses a proper chi-square test of
   homogeneity (a 7 × 2 table: class counts of all legitimate vs all attack test values, df = 6),
   where counts are in the thousands and `E_i ≥ 5` holds. A cell that still falls below 5 is merged
   for that test only, and the merge is stated.
4. **Deviation from Kruegel & Vigna, stated.** Their idealised character distribution sorts the
   256 byte frequencies and bins the ranks into six groups, ignoring _which_ characters occur. We
   keep character identity (a `'` is not an `e`) because injection depends on it. Their variant may
   be implemented as a comparison if time allows.

## Alternatives considered

| Alternative                             | Why rejected                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Merge rare classes until `E_i ≥ 5`      | Destroys the signal the test is for                                                                                                 |
| Exact multinomial / Monte Carlo p-value | Valid for small counts, but needs a seeded RNG inside `core` and far more work; the empirical threshold already handles calibration |
| G-test or KL divergence                 | Same small-count problem, and less familiar for the course                                                                          |
| Kruegel & Vigna's sorted distribution   | Loses character identity; kept as an optional comparison                                                                            |

## Consequences

### Positive

- The chi-square score is defined for every value, with a documented, defensible rationale.
- The classical test, with its `E_i ≥ 5` condition, is still applied where it is valid.

### Negative / risks

- The report must not present the per-request p-value as a calibrated probability.
- One unseen class (e.g. the first uppercase letter in a field that never had one) produces a
  very large χ². That is correct behaviour, but it is a source of false positives that realistic
  legitimate traffic (A-02) and the calibration step must expose.

### Actions

- [x] `CHAR_CLASSES` / `SPECIAL_CHARS` updated; `CLAUDE.md` §7, standards §3 and methods.md §0/§4
      aligned.
- [ ] C-03 implements the score; C-08 the dataset-level test of homogeneity.
