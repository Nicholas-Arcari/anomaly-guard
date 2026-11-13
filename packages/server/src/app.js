// The monitor as an Express app, separate from the listening socket (server.js), so tests can
// start it on a free local port. It only measures requests and returns verdicts: no payload is
// ever forwarded, executed or acted on (ADR-001).
//
// At startup it fits the statistical model on legitimate traffic only (ADR-004) and calibrates
// one threshold per mode on a separate legitimate-only batch, at a target false-positive rate
// (ADR-009, B-02). Both batches come from one seeded `buildDataset` call, so a given configuration
// always yields the same model and the same thresholds.

import express from 'express';
import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { thresholdAtFpr } from '@anomaly-guard/evaluation';

export const MODES = ['combined', 'stats', 'rules'];
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const MAX_PARAMS = 100;

/**
 * @typedef {Object} AppOptions
 * @property {number} [seed=1]                dataset seed (training and calibration batches)
 * @property {number} [trainSize=2000]        legitimate requests the model is fitted on
 * @property {number} [calibrationSize=2000]  legitimate requests the thresholds are set on
 * @property {number} [targetFpr=0.01]        false-positive rate the thresholds aim at
 */

/**
 * Build the monitor: model, calibrated thresholds and routes.
 * @param {AppOptions} [options]
 */
export function createApp({
  seed = 1,
  trainSize = 2000,
  calibrationSize = 2000,
  targetFpr = 0.01,
} = {}) {
  const { train, calibration } = buildDataset({ seed, trainSize, calibrationSize, testSize: 0 });
  const ruleEngine = new RuleEngine();
  const model = trainStatModel(train.map((s) => s.request)); // legitimate only (ADR-004)

  // One threshold per mode that uses it; in `rules` mode the verdict is the rule match alone.
  /** @type {Record<string, ReturnType<typeof thresholdAtFpr>>} */
  const calibrated = {};
  for (const mode of ['stats', 'combined']) {
    const scores = calibration.map(
      (s) => detect(s.request, { ruleEngine, model, mode, threshold: 0 }).score,
    );
    calibrated[mode] = thresholdAtFpr(scores, targetFpr);
  }
  const calibrationInfo = {
    seed,
    size: calibrationSize,
    targetFpr,
    thresholds: { stats: calibrated.stats.threshold, combined: calibrated.combined.threshold },
    calibrationFpr: {
      stats: calibrated.stats.calibrationFpr,
      combined: calibrated.combined.calibrationFpr,
    },
    attainable: { stats: calibrated.stats.attainable, combined: calibrated.combined.attainable },
  };

  const app = express();
  app.use(express.json({ limit: '64kb' }));
  // JSON has no Infinity: a rule hit in combined mode scores +Infinity (ADR-007), sent as "Infinity".
  app.set('json replacer', (_key, value) => (value === Infinity ? 'Infinity' : value));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', trainedOn: model.trainedOn, calibration: calibrationInfo });
  });

  /**
   * POST /ingest — body: { method?, path?, params?, mode?, threshold? }. Values are already
   * URL-decoded (ADR-006). The threshold defaults to the calibrated one for the mode; a request
   * may pass its own (−log10 p scale). Returns the detector verdict, never acts on the payload.
   */
  app.post('/ingest', (req, res) => {
    const parsed = parseIngest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const { request, mode, threshold: requested } = parsed;
    const threshold = requested ?? (mode === 'rules' ? 0 : calibrated[mode].threshold); // unused in rules mode
    const result = detect(request, { ruleEngine, model, threshold, mode });
    res.json({
      request,
      mode,
      threshold: mode === 'rules' ? null : threshold,
      thresholdSource:
        mode === 'rules' ? 'none' : requested === undefined ? 'calibrated' : 'request',
      ...result,
    });
  });

  // Malformed JSON and oversized bodies are the client's fault: answer 400/413, not 500.
  app.use((err, _req, res, next) => {
    if (err?.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'body is not valid JSON' });
    if (err?.type === 'entity.too.large')
      return res.status(413).json({ error: 'body larger than 64kb' });
    return next(err);
  });

  return { app, model, calibration: calibrationInfo };
}

/**
 * Validate an /ingest body.
 * @param {unknown} body
 * @returns {{ error: string } | { request: { method: string, path: string, params: Record<string, string> }, mode: string, threshold: number | undefined }}
 */
export function parseIngest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'body must be a JSON object' };
  }
  const { method = 'GET', path = '/', params = {}, mode = 'combined', threshold } = body;
  if (typeof method !== 'string' || !METHODS.includes(method.toUpperCase())) {
    return { error: `method must be one of ${METHODS.join(', ')}` };
  }
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 2048) {
    return { error: 'path must be a string that starts with "/" (at most 2048 characters)' };
  }
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    return { error: 'params must be an object of name → string value' };
  }
  const entries = Object.entries(params);
  if (entries.length > MAX_PARAMS) return { error: `at most ${MAX_PARAMS} parameters` };
  if (entries.some(([, value]) => typeof value !== 'string')) {
    return { error: 'every parameter value must be a string (already URL-decoded)' };
  }
  if (!MODES.includes(mode)) return { error: `mode must be one of ${MODES.join(', ')}` };
  if (
    threshold !== undefined &&
    !(typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0)
  ) {
    return { error: 'threshold must be a finite number ≥ 0 (−log10 p scale)' };
  }
  return {
    request: { method: method.toUpperCase(), path, params: Object.fromEntries(entries) },
    mode,
    threshold,
  };
}
