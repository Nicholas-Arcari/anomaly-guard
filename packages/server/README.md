# @anomaly-guard/server

A tiny Express monitor that demonstrates the realistic **ingest → analyse → verdict** loop on
your machine. **Node only** — it is not deployed and not part of the GitHub Pages demo (the
dashboard runs the same `core` in the browser, ADR-003).

It binds to `127.0.0.1` and never forwards, executes, or acts on a payload — it only measures the
request and returns a verdict (ADR-001).

## Run

```bash
npm run dev:server        # from the repo root
# or: npm run start --workspace @anomaly-guard/server
# listens on http://127.0.0.1:3100
```

Environment: `PORT` (default 3100), `TARGET_FPR` (default `0.01`), `CALIBRATION_SIZE` (default
2000), `SEED` (default 1).

## What happens at startup (B-02)

One seeded `buildDataset` call gives two **legitimate-only** batches:

1. **Training batch:** the statistical model is fitted on it (ADR-004).
2. **Calibration batch:** one threshold per mode (`stats`, `combined`) is set on it with
   `thresholdAtFpr`, so that about `TARGET_FPR` of legitimate requests are flagged (ADR-009).

The same configuration always gives the same model and thresholds. If the target cannot be met,
`attainable` is `false`. That happens in `combined` mode when the rules alone already flag more
legitimate requests than the target allows.

## Endpoints

- `GET /health` → `{ status, trainedOn, calibration: { seed, size, targetFpr, thresholds,
calibrationFpr, attainable } }`.
- `POST /ingest` → the detector verdict. The body is
  `{ method?, path?, params?, mode?, threshold? }`, with values already URL-decoded (ADR-006).
  - **Threshold:** the calibrated one for the mode, unless the request passes its own on the
    −log10 p scale. The response says which one was used: `thresholdSource` is `calibrated`,
    `request` or `none` (rules mode).
  - **Infinity:** a rule hit in `combined` mode scores `"Infinity"`, because JSON has no infinity.
  - **Validation:** the body must be an object; `method` one of GET, POST, PUT, PATCH, DELETE,
    HEAD, OPTIONS; `path` a string starting with `/`; `params` an object of string values; `mode`
    one of `combined`, `stats`, `rules`; `threshold` a finite number ≥ 0. Otherwise the answer is
    **400** with an `error`. Malformed JSON gives 400, a body over 64 kB gives 413.

```bash
curl -s http://127.0.0.1:3100/ingest \
  -H 'content-type: application/json' \
  -d '{"method":"GET","path":"/login","params":{"user":"'"'"' OR '"'"'1'"'"'='"'"'1"}}'
# → { "request": {...}, "mode": "combined", "threshold": ..., "thresholdSource": "calibrated",
#     "verdict": "attack", "score": "Infinity", "reasons": [...] }
```

## Test

```bash
npm test --workspace @anomaly-guard/server   # starts the app on a free local port
```

## Status

The app (`src/app.js`) is separate from the listening socket (`src/server.js`), so the tests run
it on a free port. Startup calibration and body validation are done (B-02). The verdict stream
for the dashboard (B-03) was cut.
