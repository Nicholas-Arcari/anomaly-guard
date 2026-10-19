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
const { seed, train, test } = buildDataset({
  seed: 42,
  trainSize: 500,
  testSize: 500,
  prevalence: 0.1,
});
// train: legitimate-only samples (for fitting the statistical model — ADR-004)
// test:  legit + attacks, with `prevalence` as the test-set base rate (for evaluation)
// each sample: { request, label: 'legit' | 'attack', kind }
```

Record the `seed` with every reported result — it reproduces the whole dataset.

## Status

Implemented: seeded RNG, baseline legit + attack generators, dataset builder with a
train/test split. To do: richer legit traffic (A-02), broader and obfuscated/novel attacks
(A-03/A-04), and the committed "hard cases" fixtures (A-05). See the backlog.

## Test

```bash
npm test --workspace @anomaly-guard/traffic
```
