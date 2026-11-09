# ADR-006: Dataset and request contract

**Date:** 2026-11-08
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

A baseline run (seed 42, 800 legitimate training requests, 1000 test requests at 10% attacks)
showed artefacts in the generated data that made the results meaningless rather than merely
optimistic:

- Attacks were placed in parameters (`id`, `file`, `cmd`) that legitimate traffic never uses. The
  parameter _name_ alone separated the classes: 60 of 100 attacks scored exactly 0 because the
  length model skips unseen parameters, and a model that flagged unseen parameters would have
  scored perfectly for the wrong reason.
- Samples carried no marker of _known_ vs _novel_ attacks, so the comparison ADR-004 requires
  could not be computed.
- It was not specified whether parameter values are raw or URL-decoded, so it was unclear whether
  an encoded payload is an ordinary or an evasive input.

## Decision

1. **Injection model.** An attack is a generated legitimate request with **one** parameter value
   replaced by a payload. The attacker controls values, not the endpoint's schema: same method,
   path and parameter names as legitimate traffic. Attacks that add or remove parameters can be
   added later as their own `kind`.
2. **Variant label.** Every sample is `{ request, label, kind, variant }`:

   | `label`  | `variant`    | Meaning                                                                      |
   | -------- | ------------ | ---------------------------------------------------------------------------- |
   | `legit`  | `typical`    | ordinary traffic from the legitimate generators                              |
   | `legit`  | `hard`       | legitimate but unusual input — the false-positive hard cases (A-05)          |
   | `attack` | `canonical`  | textbook form of a family the rule set targets (sqli, xss, traversal, cmdi)  |
   | `attack` | `obfuscated` | a targeted family transformed to dodge signatures (encoding, comments, …)    |
   | `attack` | `novel`      | a family the rule set has **no** signature for, by design (e.g. `oversized`) |

   The variant records **how the sample was made**, never whether a detector catches it;
   otherwise "novel" would be defined by the very result it is meant to measure. Like the label,
   the variant drives evaluation only, never training.

3. **Decoded values.** `request.params` holds values as the application sees them, **after the
   server's single URL-decoding pass** (as Express gives `req.query` / `req.body`). A value that
   still contains `%xx` was double-encoded by the sender: an `obfuscated` variant, and exactly what
   the `hasEncoding` feature flags. The rule engine matches values as they are and does not decode
   again; a normalising rule engine is a possible B-01 extension, to be recorded here if adopted.
4. **Rules are written blind.** Signatures (B-01) target the canonical families and are not tuned
   on the obfuscated or novel payloads of the test set.

## Alternatives considered

| Alternative                                        | Why rejected                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Keep random parameter names for attacks            | The parameter name becomes a perfect, meaningless separator                                                          |
| Define "novel" as "missed by the rules"            | Circular: the category would be defined by the outcome being measured                                                |
| Treat values as raw and decode inside `core`       | Closer to a real WAF, but adds a normalisation layer and moves the obfuscation story elsewhere; revisit in B-01      |
| Replace the generator with a public dataset (CSIC) | Still lab-generated, with less control over prevalence and hard cases (ADR-001); possible later as an external check |

## Consequences

### Positive

- Detection can no longer succeed or fail because of the parameter name.
- Known vs obfuscated vs novel attacks, and the false-positive rate on hard legitimate inputs, can
  be reported separately.

### Negative / risks

- Results now depend heavily on how realistic the legitimate generators are (A-02): narrow,
  artificial length or character distributions still make detection too easy. After this change
  the combined detector caught 100% of attacks at 1% FPR on the baseline data — a sign that the
  legitimate traffic is still too regular, not that the detector is good.
- Changing the generators changes every dataset for a given seed, so results are identified by
  seed **and** commit (ADR-009).

### Actions

- [x] `makeAttackRequest` injects into a generated legitimate request; samples carry `variant`.
- [x] Encoded payloads labelled `obfuscated`; `oversized` (no rule family) labelled `novel`.
- [ ] A-02 realistic legitimate traffic; A-04 obfuscated and novel payloads; A-05 hard cases.
