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

Pages needs a **public** repository on GitHub Free (a private one needs GitHub Pro, free with the
Student Developer Pack); the published site is public either way. `dist/` is git-ignored, so it is
pushed from a throwaway repository created inside it (`git subtree` cannot work on an ignored
folder). From the repo root, in bash (Git Bash on Windows):

```bash
npm run build
cd packages/dashboard/dist
touch .nojekyll                      # serve the files as they are, no Jekyll processing
git init -q -b gh-pages
git add -A
git commit -q -m "deploy: dashboard"
git push -f "$(git -C ../../.. remote get-url origin)" gh-pages
rm -rf .git                          # drop the throwaway repository
cd ../../..
```

Then, once: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` /
`(root)`**. The site appears at `https://<user>.github.io/anomaly-guard/` (`base: './'` makes the
build work there). `gh-pages` keeps no history: each publish replaces it.

(The usual one-line GitHub Actions deploy workflow is intentionally omitted; add it later with a
follow-up ADR if the team wants automated publishing.)

## Status

Boots and shows the confusion matrix, FPR/FNR/F1 and a verdict table with the variant of each
sample and the reason it was flagged (E-01). The threshold is on the −log10(p) scale (ADR-007).
To do: character-distribution histograms, score distributions, ROC curve (Chart.js), the
base-rate explainer, and a target-FPR control using the calibration split (E-02/E-03/E-06).
