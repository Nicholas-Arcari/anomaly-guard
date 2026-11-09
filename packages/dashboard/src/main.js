// Dashboard: run the whole pipeline client-side (ADR-003) — build a dataset, train on normal
// traffic, detect over the held-out test set, and show the verdicts and metrics. No backend.
// Extend in E-02/E-03: character-distribution histograms, score distributions, ROC, base-rate.

import { RuleEngine, trainStatModel, detect } from '@anomaly-guard/core';
import { buildDataset } from '@anomaly-guard/traffic';
import { confusionMatrix, metrics } from '@anomaly-guard/evaluation';

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));

function runExperiment() {
  const seed = Number($('seed').value);
  const testSize = Number($('size').value);
  const prevalence = Number($('prevalence').value);
  const threshold = Number($('threshold').value);
  const mode = /** @type {'combined'|'rules'|'stats'} */ ($('mode').value);

  const { train, test } = buildDataset({ seed, trainSize: 800, testSize, prevalence });

  const ruleEngine = new RuleEngine();
  const model = trainStatModel(train.map((s) => s.request)); // normal only (ADR-004)

  const rows = test.map((s) => {
    const result = detect(s.request, { ruleEngine, model, threshold, mode });
    return { sample: s, result, correct: (result.verdict === 'attack') === (s.label === 'attack') };
  });

  const predicted = rows.map((r) => r.result.verdict === 'attack');
  const actual = rows.map((r) => r.sample.label === 'attack');
  const cm = confusionMatrix(predicted, actual);
  const m = metrics(cm);

  renderCards(cm, m);
  renderTable(rows);
}

/** @param {{tp:number,fp:number,tn:number,fn:number}} cm @param {ReturnType<typeof metrics>} m */
function renderCards(cm, m) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const cards = [
    { k: 'True positives', v: cm.tp },
    { k: 'False positives', v: cm.fp },
    { k: 'False negatives', v: cm.fn },
    { k: 'True negatives', v: cm.tn },
    { k: 'Recall (TPR)', v: pct(m.recall) },
    { k: 'FPR', v: pct(m.fpr) },
    { k: 'FNR', v: pct(m.fnr) },
    { k: 'F1', v: m.f1.toFixed(3) },
  ];
  document.getElementById('cards').innerHTML = cards
    .map((c) => `<div class="card"><div class="k">${c.k}</div><div class="v">${c.v}</div></div>`)
    .join('');
}

/** @param {{sample:any,result:any,correct:boolean}[]} rows */
function renderTable(rows) {
  const sample = rows.slice(0, 60);
  const head =
    '<thead><tr><th>Path</th><th>Payload</th><th>Actual</th><th>Verdict</th><th>Score</th><th>Why</th></tr></thead>';
  const body = sample
    .map(({ sample: s, result, correct }) => {
      const payload = Object.entries(s.request.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      const why = result.reasons.length ? result.reasons.join('; ') : '—';
      return (
        `<tr class="${correct ? '' : 'wrong'}">` +
        `<td>${escapeHtml(s.request.path)}</td>` +
        `<td class="payload">${escapeHtml(payload)}</td>` +
        `<td><span class="tag ${s.label}">${s.label}</span> ${escapeHtml(s.variant)}</td>` +
        `<td><span class="tag ${result.verdict}">${result.verdict}</span></td>` +
        // A rule hit in combined mode scores +Infinity (ADR-007).
        `<td>${Number.isFinite(result.score) ? result.score.toFixed(2) : '∞'}</td>` +
        `<td>${escapeHtml(why)}</td>` +
        '</tr>'
      );
    })
    .join('');
  document.getElementById('results').innerHTML = head + `<tbody>${body}</tbody>`;
}

// The payload is untrusted text we only ever display — escape it so the dashboard never renders
// an XSS sample as HTML (ADR-001: payloads are measured, never executed/rendered).
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

document.getElementById('run').addEventListener('click', runExperiment);
runExperiment();
