import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { thresholdAtFpr } from '@anomaly-guard/evaluation';
import { createApp, parseIngest } from '../src/app.js';

const OPTIONS = { seed: 3, trainSize: 300, calibrationSize: 500, targetFpr: 0.02 };
const { app, calibration } = createApp(OPTIONS);
let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

const ingest = (body) =>
  fetch(`${base}/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('createApp: thresholds are calibrated on the legitimate batch at the target FPR (B-02)', () => {
  // Recompute from the same seeded batches: the server must agree exactly.
  const { train, calibration: batch } = buildDataset({ ...OPTIONS, testSize: 0 });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(train.map((s) => s.request));
  for (const mode of ['stats', 'combined']) {
    const scores = batch.map(
      (s) => detect(s.request, { ruleEngine, model, mode, threshold: 0 }).score,
    );
    const expected = thresholdAtFpr(scores, OPTIONS.targetFpr);
    assert.equal(calibration.thresholds[mode], expected.threshold, mode);
    assert.equal(calibration.calibrationFpr[mode], expected.calibrationFpr, mode);
    if (expected.attainable) assert.ok(expected.calibrationFpr <= OPTIONS.targetFpr);
  }
});

test('GET /health reports the model and the calibration', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.trainedOn, OPTIONS.trainSize);
  assert.equal(body.calibration.size, OPTIONS.calibrationSize);
  assert.equal(body.calibration.targetFpr, OPTIONS.targetFpr);
  assert.ok(Number.isFinite(body.calibration.thresholds.stats));
  assert.ok(Number.isFinite(body.calibration.thresholds.combined));
});

test('POST /ingest uses the calibrated threshold unless the request passes one', async () => {
  const legit = { method: 'GET', path: '/search', params: { q: 'red shoes' }, mode: 'stats' };
  const calibrated = await (await ingest(legit)).json();
  assert.equal(calibrated.thresholdSource, 'calibrated');
  assert.equal(calibrated.threshold, calibration.thresholds.stats);
  const explicit = await (await ingest({ ...legit, threshold: 2 })).json();
  assert.equal(explicit.thresholdSource, 'request');
  assert.equal(explicit.threshold, 2);
});

test('POST /ingest flags a canonical attack in combined mode', async () => {
  const res = await ingest({
    method: 'POST',
    path: '/login',
    params: { user: "' OR '1'='1", pass: 'x' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.verdict, 'attack');
  assert.equal(body.score, 'Infinity'); // a rule hit, serialised for JSON
  assert.equal(body.ruleMatched, true);
});

test('POST /ingest rejects malformed bodies with 400', async () => {
  const bad = [
    [],
    { params: 'q=1' },
    { params: { q: 1 } },
    { path: 'search' },
    { method: 'TRACE' },
    { mode: 'magic' },
    { threshold: -1 },
    { threshold: 'high' },
  ];
  for (const body of bad) {
    const res = await ingest(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
  const notJson = await ingest('{ not json');
  assert.equal(notJson.status, 400);
});

test('parseIngest: defaults and normalisation', () => {
  assert.deepEqual(parseIngest({}), {
    request: { method: 'GET', path: '/', params: {} },
    mode: 'combined',
    threshold: undefined,
  });
  assert.equal(parseIngest({ method: 'post' }).request.method, 'POST');
});
