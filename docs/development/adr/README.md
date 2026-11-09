# Architectural Decision Records (ADR)

An ADR records **one** decision: the problem, the options weighed, the choice, and its
consequences. ADRs are not deleted; a superseded one is marked `Superseded by ADR-XXX`.

## Index

| ADR                                                             | Title                                                                   | Status                        | Date       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- | ---------- |
| [ADR-001](ADR-001-scope-and-educational-boundaries.md)          | Scope and educational boundaries (simulation only)                      | Accepted                      | 2026-10-19 |
| [ADR-002](ADR-002-javascript-monorepo-stack.md)                 | JavaScript + npm workspaces monorepo                                    | Accepted                      | 2026-10-19 |
| [ADR-003](ADR-003-client-side-first-for-github-pages.md)        | Client-side-first so the demo runs on GitHub Pages                      | Accepted                      | 2026-10-19 |
| [ADR-004](ADR-004-evaluation-methodology.md)                    | Evaluation methodology: train-on-normal, held-out test, threshold sweep | Accepted (refined by ADR-009) | 2026-10-19 |
| [ADR-005](ADR-005-no-ci-cd.md)                                  | No CI/CD; local checks only                                             | Accepted                      | 2026-10-19 |
| [ADR-006](ADR-006-dataset-and-request-contract.md)              | Dataset and request contract: injection, variants, decoded values       | Accepted                      | 2026-11-08 |
| [ADR-007](ADR-007-per-parameter-models-and-score-scale.md)      | Per-(path, parameter) models and the common −log10(p) score scale       | Accepted                      | 2026-11-08 |
| [ADR-008](ADR-008-character-classes-and-chi-square-score.md)    | Seven character classes; chi-square as a smoothed score                 | Accepted                      | 2026-11-08 |
| [ADR-009](ADR-009-threshold-calibration-seeds-and-intervals.md) | Threshold calibration at a target FPR, repeated seeds, CIs              | Accepted                      | 2026-11-08 |

## When to write an ADR

- introducing, replacing or removing a library or tool;
- changing the detection method or the feature set in a way that affects results;
- changing the evaluation methodology (split, metrics, thresholds);
- a deviation from the [standards](../standards.md).

## Template

```markdown
# ADR-XXX: Title

**Date:** YYYY-MM-DD
**Status:** Proposed
**Author:** Name

## Context

The problem and the forces at play. Why decide now?

## Decision

The choice, clearly and verifiably.

## Alternatives considered

For each: short description and why it was rejected.

## Consequences

### Positive

### Negative / risks

### Actions

- [ ] ...
```
