// Express live monitor. Demonstrates the realistic ingest → analyse → verdict loop LOCALLY.
// It binds to localhost only and never forwards, executes, or acts on a payload (ADR-001):
// it only measures the request and returns a verdict. Node only — not part of the Pages demo.
//
// Extend in B-02/B-03: a verdict stream for the dashboard, a richer model, request logging.

import express from 'express';
import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { createRng, makeLegitRequest } from '@anomaly-guard/traffic';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3100);

// Train the statistical model once at startup, on a batch of NORMAL traffic only (ADR-004).
function trainStartupModel(seed = 1, n = 500) {
  const rng = createRng(seed);
  const normal = Array.from({ length: n }, () => makeLegitRequest(rng).request);
  return trainStatModel(normal);
}

const ruleEngine = new RuleEngine();
const model = trainStartupModel();

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', trainedOn: model.trainedOn });
});

/**
 * POST /ingest
 * Body: an AgRequest { method, path, params } plus optional { threshold, mode }.
 * Returns the detector verdict. The payload is measured, never executed.
 */
app.post('/ingest', (req, res) => {
  const {
    method = 'GET',
    path = '/',
    params = {},
    threshold = 3,
    mode = 'combined',
  } = req.body ?? {};
  const request = { method, path, params };
  const result = detect(request, { ruleEngine, model, threshold, mode });
  res.json({ request, ...result });
});

app.listen(PORT, HOST, () => {
  console.log(
    `[anomaly-guard] monitor listening on http://${HOST}:${PORT} (model trained on ${model.trainedOn})`,
  );
});
