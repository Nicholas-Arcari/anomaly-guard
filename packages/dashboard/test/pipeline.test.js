import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runExperiment, sourceOf, topPart, countBy, TRAIN_SIZE } from '../src/pipeline.js';
import { DEFAULTS } from '../src/state.js';

const state = { ...DEFAULTS, size: 300 };

test('runExperiment: same settings, same results (seeded, reproducible)', () => {
  const summary = (run) => run.events.map((e) => [e.id, e.alert, e.level, e.result.score]);
  assert.deepEqual(summary(runExperiment(state)), summary(runExperiment(state)));
});

test('runExperiment: trains on legitimate traffic only and scores the whole test split', () => {
  const run = runExperiment(state);
  assert.ok(run.dataset.train.every((s) => s.label === 'legit'));
  assert.equal(run.model.trainedOn, TRAIN_SIZE);
  assert.equal(run.events.length, state.size);
  const { tp, fp, tn, fn } = run.cm;
  assert.equal(tp + fp + tn + fn, state.size);
  assert.equal(tp + fp, run.events.filter((e) => e.alert).length);
});

test('runExperiment: every alert has a source, every non-alert none; levels stay in 0–15', () => {
  for (const mode of ['combined', 'stats', 'rules']) {
    const run = runExperiment({ ...state, mode });
    for (const e of run.events) {
      assert.equal(e.source === 'none', !e.alert, `${mode} #${e.id}`);
      assert.ok(e.level >= 0 && e.level <= 15);
    }
  }
});

test('sourceOf: signature, statistics or both', () => {
  const r = (ruleMatched, statScore) => ({ ruleMatched, statScore });
  assert.equal(sourceOf(r(true, 0), true, 1, 'combined'), 'signature');
  assert.equal(sourceOf(r(true, 2), true, 1, 'combined'), 'both');
  assert.equal(sourceOf(r(false, 2), true, 1, 'stats'), 'statistics');
  assert.equal(sourceOf(r(true, 2), true, 1, 'rules'), 'signature');
  assert.equal(sourceOf(r(false, 0), false, 1, 'combined'), 'none');
});

test('topPart and countBy', () => {
  assert.deepEqual(topPart({ length: 1.5, chiSquare: 3 }), { name: 'chiSquare', score: 3 });
  assert.equal(topPart({}), null);
  assert.deepEqual(
    [...countBy(['a', 'b', 'a'], (x) => x)],
    [
      ['a', 2],
      ['b', 1],
    ],
  );
});
