# @anomaly-guard/core

The shared detection engine. **Pure JavaScript — no DOM, no Node-only APIs** — so it runs
unchanged in the browser (for the GitHub Pages demo) and in Node (server + tests). See
[`../../docs/development/project-structure.md`](../../docs/development/project-structure.md) §3–§4.

## Exports

```js
import {
  // features
  extractFeatures,
  paramFeatures,
  // character stats
  shannonEntropy,
  charClassCounts,
  charHistogram,
  classifyChar,
  CHAR_CLASSES,
  SPECIAL_CHARS,
  // rules
  RuleEngine,
  DEFAULT_RULES,
  // statistical models
  trainStatModel,
  scoreRequest,
  lengthZScore,
  chiSquareScore /* stub: C-03 */,
  // detector
  detect,
} from '@anomaly-guard/core';
```

## Request shape

```js
/** @type {import('@anomaly-guard/core').AgRequest} */
const request = {
  method: 'GET',
  path: '/search',
  params: { q: 'red shoes' }, // every user-controlled value, keyed by name
};
```

## Typical use

```js
import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';

const engine = new RuleEngine();
const model = trainStatModel(legitimateRequests); // train on NORMAL only (ADR-004)

const result = detect(request, { ruleEngine: engine, model, threshold: 3, mode: 'combined' });
// → { verdict: 'attack' | 'legit', score, ruleMatched, reasons, detail }
```

## Status

Implemented: entropy + character-class features, feature extraction, a starter rule engine, a
baseline statistical model (length z-score), and a baseline detector. Stubs with a backlog id:
`chiSquareScore` (C-03, the headline method), robust/multivariate outliers (C-05), the richer
score combination (C-06). The maths is in
[`../../docs/statistics/methods.md`](../../docs/statistics/methods.md).

## Test

```bash
npm test --workspace @anomaly-guard/core
```
