# Project brief — Project 5: The Anomaly Guard

> This is the assignment as given by the instructor. It **defines the scope**: anything not
> described here is out of scope and must be agreed before it is built (see
> [`CLAUDE.md`](../CLAUDE.md) §2 and [`development/standards.md`](development/standards.md) §1).
> Do not edit the quoted text; add our interpretation under "Notes" at the bottom.

## Assignment (verbatim)

> **PROJECT 5 — The Anomaly Guard: Intrusion Detection and Statistical Anomaly Detection**
>
> Build a lightweight application that monitors simulated web requests, including HTTP payloads,
> query parameters, input lengths, and character distributions. The system should combine simple
> rule-based checks with statistical anomaly detection. Possible methods include the chi-square
> test, confidence intervals, outlier detection, and comparisons between normal and unusual
> traffic patterns.
>
> The goal is to investigate how statistical methods can identify suspicious behavior without
> relying exclusively on predefined attack signatures. Evaluate the system using both legitimate
> and simulated malicious requests, paying attention to false positives and false negatives.

## Context (from the course description)

> The projects explore some areas of modern digital systems [...]. The goal is to build extremely
> simplified yet "realistic" educational prototypes and connect software development with applied
> statistics, probability, and data analysis. [...] Although the didactic projects are carried
> out in groups, every student can document their own contribution at the end, and individual
> assessment will be taken into account.

Groups of 3–5 students. Every member documents their own contribution — see the ownership map in
[`CLAUDE.md`](../CLAUDE.md) §4 and the task board in [`planning/backlog.md`](planning/backlog.md).

## Notes (our interpretation — editable)

These are decisions and readings of the brief that we have agreed on. Each one that affects
architecture or method should also become an ADR.

- **"Simulated web requests"** → we generate traffic ourselves, with a seeded generator. We do
  **not** capture a real network or send requests to a real host. (ADR-001)
- **"combine simple rule-based checks with statistical anomaly detection"** → two independent
  engines plus a combined detector, so we can report rules-only, stats-only, and combined.
- **"without relying exclusively on predefined attack signatures"** → the statistical model is
  trained on normal traffic only and must catch attacks the rules do not know; we deliberately
  include novel / obfuscated attacks in the test set to show this. (ADR-004)
- **"paying attention to false positives and false negatives"** → the evaluation is a first-class
  deliverable: confusion matrix, FPR/FNR, precision/recall/F1, ROC/AUC, and a base-rate
  discussion. (ADR-004)
- **Statistical methods we will implement:** Shannon entropy and character-class features;
  chi-square test on the character distribution (Kruegel & Vigna 2003); confidence intervals on
  input lengths; outlier detection (z-score / IQR / MAD, and Mahalanobis for the multivariate
  case). Details in [`statistics/methods.md`](statistics/methods.md).
