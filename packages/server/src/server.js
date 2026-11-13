// Express live monitor. Demonstrates the realistic ingest → analyse → verdict loop LOCALLY.
// It binds to localhost only and never forwards, executes, or acts on a payload (ADR-001): it
// only measures the request and returns a verdict. Node only — not part of the Pages demo.
//
// Configuration (environment): PORT (default 3100), TARGET_FPR (default 0.01, the false-positive
// rate the thresholds are calibrated for), CALIBRATION_SIZE (default 2000), SEED (default 1).

import { createApp } from './app.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3100);

const { app, model, calibration } = createApp({
  seed: Number(process.env.SEED ?? 1),
  calibrationSize: Number(process.env.CALIBRATION_SIZE ?? 2000),
  targetFpr: Number(process.env.TARGET_FPR ?? 0.01),
});

app.listen(PORT, HOST, () => {
  const t = calibration.thresholds;
  console.log(
    `[anomaly-guard] monitor on http://${HOST}:${PORT} · model trained on ${model.trainedOn} ` +
      `legitimate requests · thresholds for ${calibration.targetFpr * 100}% false positives on ` +
      `${calibration.size} legitimate requests: stats ${t.stats.toFixed(3)}, combined ${t.combined.toFixed(3)}`,
  );
});
