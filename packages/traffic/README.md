# @anomaly-guard/traffic

Seeded, **reproducible** generator of simulated web requests and a labelled dataset builder.
All traffic is synthetic; malicious samples are public example strings used only as detector
input and are never executed or sent (ADR-001). Pure JS — runs in the browser and in Node.

## Exports

```js
import {
  createRng,
  makeLegitRequest,
  makeAttackRequest,
  buildDataset,
} from '@anomaly-guard/traffic';
```

## Dataset

```js
const { seed, train, calibration, test } = buildDataset({
  seed: 42,
  trainSize: 500,
  calibrationSize: 1000,
  testSize: 500,
  prevalence: 0.1,
});
// train:       legitimate only — fits the statistical model (ADR-004)
// calibration: legitimate only — fixes the threshold at a target FPR (ADR-009)
// test:        legit + attacks, with `prevalence` as the test-set base rate (for evaluation)
// each sample: { request, label: 'legit' | 'attack', kind, variant }
```

An attack is a generated legitimate request with **one** parameter value replaced by a payload,
so it has the same method, path and parameter names as normal traffic (ADR-006). `variant` says
how the sample was made: legit `typical` | `hard`; attack `canonical` | `obfuscated` | `novel`.
It drives evaluation only, never training.

The seed is required and must be an unsigned 32-bit integer. Split sizes must be non-negative
safe integers; `prevalence` and `hardShare` must be finite numbers from 0 to 1. The test set has
`round(testSize × prevalence)` attacks and `round(legitimate test count × hardShare)` hard cases.
Generated splits contain separate samples, though their values can coincide by chance.

Record the `seed` and the git commit with every reported result — together they reproduce the
whole dataset.

## Status

Implemented: seeded RNG, baseline legit generators, attacks injected into legit requests with a
variant, dataset builder with train / calibration / test splits. To do: realistic legit traffic
(A-02), broader canonical attacks (A-03), obfuscated/novel attacks (A-04), and the "hard cases"
in the test set (A-05). See the backlog for the checklists.

## Test

```bash
npm test --workspace @anomaly-guard/traffic
```
