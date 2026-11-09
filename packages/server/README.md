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
# listens on http://127.0.0.1:3100  (override with PORT)
```

## Endpoints

- `GET /health` → `{ status: 'ok', trainedOn }`
- `POST /ingest` with an `AgRequest` body (values already URL-decoded, ADR-006) and optional
  `threshold` (−log10 p scale, default 1 until B-02 calibrates it) and `mode` → the detector
  verdict. A rule hit in `combined` mode scores `"Infinity"` (JSON has no infinity); an invalid
  mode or threshold returns HTTP 400.

```bash
curl -s http://127.0.0.1:3100/ingest \
  -H 'content-type: application/json' \
  -d '{"method":"GET","path":"/login","params":{"user":"'"'"' OR '"'"'1'"'"'='"'"'1"}}'
# → { "request": {...}, "verdict": "attack", "score": ..., "reasons": [...] }
```

## Status

Starter: trains the statistical model on normal traffic at startup and exposes `/ingest` and
`/health`. To do: a threshold calibrated on legit-only traffic at startup (B-02, needs D-06), a
verdict stream for the dashboard and request logging (B-03).
