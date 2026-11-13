import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rocCurve, evaluateAt } from '../src/index.js';

const attack = (score) => ({ label: 'attack', score });
const legit = (score) => ({ label: 'legit', score });
const xy = (points) => points.map((p) => [p.fpr, p.tpr]);

/** Seeded linear congruential generator, so that the property tests are reproducible. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** AUC as the Mann–Whitney statistic: P(attack score > legit score), ties counting ½. */
function mannWhitney(scored) {
  const a = scored.filter((s) => s.label === 'attack').map((s) => s.score);
  const l = scored.filter((s) => s.label === 'legit').map((s) => s.score);
  let wins = 0;
  for (const x of a) for (const y of l) wins += x > y ? 1 : x === y ? 0.5 : 0;
  return wins / (a.length * l.length);
}

test('rocCurve: perfect separation gives AUC 1', () => {
  const r = rocCurve([attack(4), attack(3), legit(2), legit(1)]);
  assert.deepEqual(xy(r.points), [
    [0, 0],
    [0, 0.5],
    [0, 1],
    [0.5, 1],
    [1, 1],
  ]);
  assert.equal(r.auc, 1);
});

test('rocCurve: reversed scores give AUC 0, all-tied scores give 0.5', () => {
  assert.equal(rocCurve([attack(1), attack(2), legit(3), legit(4)]).auc, 0);
  const tied = rocCurve([attack(2), attack(2), legit(2), legit(2)]);
  assert.deepEqual(xy(tied.points), [
    [0, 0],
    [1, 1],
  ]);
  assert.equal(tied.auc, 0.5);
});

test('rocCurve: +Infinity (a rule hit) is the highest score; known answer 0.625', () => {
  const r = rocCurve([attack(Infinity), attack(2), legit(1), legit(Infinity)]);
  assert.deepEqual(xy(r.points), [
    [0, 0],
    [0.5, 0.5],
    [0.5, 1],
    [1, 1],
  ]);
  assert.deepEqual(
    r.points.map((p) => p.threshold),
    [Infinity, Infinity, 2, 1],
  );
  assert.equal(r.auc, 0.625);
});

test('rocCurve: a binary score (rules mode) has one inner point and AUC = (1 + TPR − FPR) / 2', () => {
  const scored = [
    attack(1),
    attack(1),
    attack(1),
    attack(0),
    legit(1),
    legit(0),
    legit(0),
    legit(0),
  ];
  const r = rocCurve(scored);
  assert.deepEqual(xy(r.points), [
    [0, 0],
    [0.25, 0.75],
    [1, 1],
  ]);
  const at = evaluateAt(scored, 1);
  assert.equal(r.auc, (1 + at.recall - at.fpr) / 2);
});

test('rocCurve: each point matches evaluateAt at its threshold', () => {
  const random = lcg(3);
  const scored = Array.from({ length: 200 }, () =>
    random() < 0.3
      ? attack(Math.round(random() * 20) / 4 + 1)
      : legit(Math.round(random() * 20) / 4),
  );
  for (const p of rocCurve(scored).points.slice(1)) {
    const at = evaluateAt(scored, p.threshold);
    assert.equal(p.tpr, at.recall);
    assert.equal(p.fpr, at.fpr);
  }
});

test('rocCurve: AUC equals the Mann–Whitney statistic, ties and +Infinity included', () => {
  const random = lcg(5);
  for (let round = 0; round < 100; round++) {
    const n = 2 + Math.floor(random() * 120);
    const scored = Array.from({ length: n }, (_, i) => {
      const isAttack = i === 0 ? true : i === 1 ? false : random() < 0.4;
      const r = random();
      const score = r < 0.05 ? Infinity : Math.round(r * 12) / 2 + (isAttack ? 1 : 0);
      return isAttack ? attack(score) : legit(score);
    });
    const { auc, points } = rocCurve(scored);
    assert.ok(Math.abs(auc - mannWhitney(scored)) < 1e-12, `round ${round}`);
    for (let j = 1; j < points.length; j++) {
      assert.ok(points[j].fpr >= points[j - 1].fpr && points[j].tpr >= points[j - 1].tpr);
    }
    assert.deepEqual(xy([points.at(-1)]), [[1, 1]]);
  }
});

test('rocCurve: rejects input it cannot evaluate', () => {
  assert.throws(() => rocCurve([attack(1), attack(2)]), RangeError); // no legitimate sample
  assert.throws(() => rocCurve([legit(1)]), RangeError); // no attack
  assert.throws(() => rocCurve([attack(Number.NaN), legit(1)]), RangeError);
  assert.throws(() => rocCurve([{ label: 'evil', score: 1 }, legit(1)]), RangeError);
  assert.throws(() => rocCurve('not an array'), RangeError);
});
