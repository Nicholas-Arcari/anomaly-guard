# @anomaly-guard/dashboard

The project's console: a **multi-page**, SIEM-style web app (ADR-010) that runs the whole pipeline
in the browser — generate the seeded traffic, learn normal behaviour from legitimate requests only,
detect, evaluate — with no backend, so it is hosted on **GitHub Pages** (ADR-003).

**Live:** <https://the-anomaly-guard.github.io/anomaly-guard/>. Showing it in a portfolio:
[`docs/guides/team-guide.md`](../../docs/guides/team-guide.md).

## Pages

| Page               | File              | Shows                                                                                                   | Theme panels still to add                             |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Overview           | `index.html`      | key figures, alerts by severity and level, what raised them, top signatures                             | —                                                     |
| Security events    | `events.html`     | every test request: verdict, level, reason, ground truth; filters and pages in the URL                  | —                                                     |
| Rules              | `rules.html`      | the signature rules and how often each matched                                                          | — (the ruleset itself is B-01)                        |
| Statistical models | `models.html`     | the signals in the score; the learned model per endpoint and parameter                                  | E-02: character classes (T1), lengths and scores (T2) |
| Detection quality  | `evaluation.html` | the calibrated operating point, confusion matrix, rates and variants with Wilson intervals, ROC and AUC | —                                                     |
| Base rate          | `base-rate.html`  | Bayes and the base-rate fallacy, with a worked example                                                  | E-03 (T4)                                             |
| About              | `about.html`      | the project, the method, the themes                                                                     | —                                                     |

## How it is built

```
dashboard/
├── *.html            one file per page
├── partials/         header, settings bar, sidebar, footer — inserted by vite.config.js
├── src/
│   ├── styles.css    the whole look: tokens, layout, components, dark mode
│   ├── shell.js      shared behaviour: settings from the URL, links, sidebar
│   ├── state.js      settings ⇄ URL (pure, tested)
│   ├── pipeline.js   dataset → train on legit traffic → threshold from the calibration split →
│   │                 detect → metrics (pure, tested)
│   ├── quality.js    Wilson intervals, results by variant, ROC and AUC per mode (pure, tested)
│   ├── levels.js     alert level 0–15 and severity (pure, tested)
│   ├── dom.js        DOM helpers: data goes in as text, never as HTML
│   ├── ui.js         KPI tile, level badge
│   ├── charts.js     Chart.js setup and helpers (bar, doughnut, ROC)
│   ├── assets/       icon
│   └── pages/        one script per page
├── test/             node:test for state, shell, levels, pipeline, quality
└── vite.config.js    page list, partials plugin, CSP
```

- **Settings in the URL**: `?seed=42&mode=combined&fpr=0.01&threshold=1&prevalence=0.1&size=1000`.
  The same URL always shows the same experiment, every internal link keeps the settings, and
  nothing is kept in browser storage — so the demo also works inside a sandboxed iframe.
- **The threshold is calibrated** (ADR-009, E-06): every page sets it on 2,000 legitimate
  calibration requests so that at most `fpr` of them raise an alert (5%, 2%, 1% or 0.5%; lower
  targets need more requests, n ≥ 10/α, and are in `npm run experiments`). `fpr=manual` uses the
  `threshold` setting instead. 5% of the legitimate test requests are hard cases.
- **Alert level** k means p ≤ 10^−k for a statistical alert; 15 means a signature matched. Severity:
  low 0–1, medium 2–3, high 4–14, critical 15. For display only: the threshold decides the verdict.
- **Security**: a strict Content Security Policy is added to every page at build time (no inline
  scripts or styles), and payloads are inserted as text only.

## Run, test, build

```bash
npm run dev                                       # from the repo root → http://localhost:5173/
npm test                                          # includes test/*.test.js of this package
npm run build                                     # → packages/dashboard/dist
npm run preview --workspace @anomaly-guard/dashboard   # serve the build → http://localhost:4173/
```

Every page has its own address: `/events.html`, `/models.html`, …

## Adding your theme's chart

1. In the page's HTML, replace your placeholder (the `<div class="placeholder">` with your task
   id) with a panel:

   ```html
   <section class="panel" aria-labelledby="roc-title">
     <div class="panel-head"><h2 class="panel-title" id="roc-title">ROC curve</h2></div>
     <div class="panel-body">
       <div class="chart-box">
         <canvas id="chart-roc" role="img" aria-label="ROC curve"></canvas>
       </div>
     </div>
   </section>
   ```

2. In the page's script (`src/pages/<page>.js`), take the data from `runExperiment(state)` and draw
   it: call `setupCharts()`, then `barChart(…)`, `rocChart(…)` or `new Chart(…)`. Register any
   other Chart.js component you need in `src/charts.js` (bars, doughnuts and lines are there).
3. Keep the statistics in the pure packages (`core`, `evaluation`) with their tests: the page only
   draws.
4. No inline styles or scripts (the CSP blocks them); data goes into the page as text only (`h()`
   in `src/dom.js`).

## Publish to GitHub Pages (manual — no CI, ADR-005)

The repository is public, so GitHub Free serves it. `dist/` is git-ignored, so it is pushed from a
throwaway repository created inside it. From the repo root, on an up-to-date `main`, in bash (Git
Bash on Windows):

```bash
npm ci && npm test && npm run build
cd packages/dashboard/dist
touch .nojekyll                      # serve the files as they are, no Jekyll processing
git init -q -b gh-pages
git add -A
git commit -q -m "deploy: dashboard from $(git -C ../../.. rev-parse --short HEAD)"
git push -f "$(git -C ../../.. remote get-url origin)" gh-pages
rm -rf .git                          # drop the throwaway repository
cd ../../..
```

GitHub Pages is already set to **Deploy from a branch → `gh-pages` / `(root)`**; the new version is
online within a few minutes at <https://the-anomaly-guard.github.io/anomaly-guard/>. `gh-pages` keeps
no history: each publish replaces it. (An automated GitHub Actions deploy is intentionally
omitted; add it with a follow-up ADR if the team wants it.)
