# Report

The final report (E-05). It has one chapter per statistical theme, plus an introduction, a method
overview, and the conclusions and limitations, which the group writes together. The report may be
in Italian (AGENTS.md §8). Each chapter here has an Italian and an English version, kept in step.

| Chapter                                | Theme | Author          | Files                                                                                 | Status |
| -------------------------------------- | ----- | --------------- | ------------------------------------------------------------------------------------- | ------ |
| Character distributions and chi-square | T1    | —               | —                                                                                     | to do  |
| Lengths and outliers                   | T2    | —               | —                                                                                     | to do  |
| Evaluation and uncertainty             | T3    | Nicholas Arcari | [IT](t3-evaluation-and-uncertainty.it.md) · [EN](t3-evaluation-and-uncertainty.en.md) | draft  |
| Probability and simulation             | T4    | Giuseppe        | —                                                                                     | to do  |

## Numbers

Every number in the report comes from `npm run experiments` (`packages/experiments`, D-04) on a
named commit. Anyone can regenerate it, so each chapter states the commit and the seeds.

The statistical score is still the baseline. When C-03, C-05 and C-06 are merged, re-run the
experiment on the final commit and update every chapter's tables.

The written method behind the numbers is in
[`../statistics/methods.md`](../statistics/methods.md); the decisions are in the ADRs (ADR-004,
ADR-009).
