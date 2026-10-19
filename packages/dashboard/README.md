# @anomaly-guard/dashboard

The browser dashboard (Vite). It runs the **whole pipeline client-side** — generate traffic,
train on normal traffic, detect over the test set, compute metrics — so it can be hosted on
**GitHub Pages** with no backend (ADR-003). Optionally it can also talk to the local
`@anomaly-guard/server`.

## Run (dev)

```bash
npm run dev          # from the repo root → http://localhost:5173
```

## Build (static)

```bash
npm run build        # → packages/dashboard/dist  (base: './', works at any path)
```

## Publish to GitHub Pages (manual — no CI, ADR-005)

```bash
npm run build
# publish the built dir to a gh-pages branch, e.g. with git subtree:
git subtree push --prefix packages/dashboard/dist origin gh-pages
# then in the repo: Settings → Pages → deploy from branch: gh-pages
```

(The usual one-line GitHub Actions deploy workflow is intentionally omitted; add it later with a
follow-up ADR if the team wants automated publishing.)

## Status

Boots and shows the confusion matrix, FPR/FNR/F1 and a verdict table with the reason each request
was flagged (E-01). To do: character-distribution histograms, score distributions, ROC curve
(Chart.js) and the base-rate explainer (E-02/E-03).
