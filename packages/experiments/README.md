# @anomaly-guard/experiments

The experiment behind the report (D-04, ADR-009): every detection mode, on many seeds, at fixed
target false-positive rates, with intervals. **Node only**: it writes files to `results/`, which
the pure packages never do. It stays offline and seeded: ESLint forbids the network and
`Math.random` here, as in `core`, `traffic` and `evaluation`. The method is in
[`../../docs/statistics/methods.md`](../../docs/statistics/methods.md) §6.

## Run

```bash
npm run experiments                    # from the repo root: 20 seeds, about 1.5 minutes
npm run experiments -- --seeds 3 --calibration 2000 --test 1000   # a quick check (warns)
npm run experiments -- --help          # every option
```

It prints where it wrote two files, `results/<date>-<commit>/`:

- `report.md`: the tables for the written report: AUC; then for each target FPR the operating
  point of each mode, the spread across seeds, the confusion matrix added up over the seeds, and
  the detection and false-positive rates by variant and by attack family / endpoint.
- `results.json`: every number, seed by seed (with its Wilson and bootstrap intervals), the
  summary across seeds, the configuration and the provenance: date, git commit, whether the tree
  had uncommitted changes, Node version.

`results/` is git-ignored: anyone can regenerate the same numbers from the seeds and the commit.
Run it from a clean tree before quoting a result; otherwise the commit does not describe the code,
and the run says so.

## What one seed does

1. `buildDataset` with that seed: a legitimate **train** split, a legitimate **calibration**
   split and a **test** split (10% attacks; 5% of its legitimate requests are hard cases).
2. Fit the statistical model on the train split only (ADR-004).
3. For each mode (`rules`, `stats`, `combined`) score the calibration and test requests.
4. For each target FPR (1% and 0.1%) set the threshold on the calibration scores
   (`thresholdAtFpr`, D-06). `rules` has no threshold: its only operating point is "flag on a
   rule match".
5. Score the test split once at that threshold: confusion matrix, TPR / FPR / FNR / precision
   with Wilson intervals, the same by variant and by kind; AUC with a seeded, stratified bootstrap
   interval (D-03, D-05).

Across seeds it reports the mean, SD and range of each value and a 95% Student-t interval for the
mean (`meanInterval`): the seed is the independent unit, so the counts are not pooled into one
Wilson interval (methods.md §6).

## Defaults

| Setting       | Value    | Why                                                    |
| ------------- | -------- | ------------------------------------------------------ |
| Seeds         | 1–20     | ADR-009: at least 20                                   |
| Train         | 2,000    | legitimate requests for the model                      |
| Calibration   | 10,000   | `n ≥ 10/α` even at α = 0.1% (methods.md §6)            |
| Test          | 5,000    | 500 attacks, 4,500 legitimate, of which 225 hard cases |
| Targets       | 1%, 0.1% | ADR-009                                                |
| AUC bootstrap | 1,000    | resamples per seed and mode, seeded with `seed + 2³¹`  |

## Use from code

```js
import { runExperiment, formatReport } from '@anomaly-guard/experiments';

const { config, summary, seeds } = runExperiment({ seeds: [1, 2, 3], testSize: 1000 });
summary.modes.stats.points[0].fpr; // { estimate, lower, upper, sd, min, max, n, level }
```

## Test

```bash
npm test --workspace @anomaly-guard/experiments
```
