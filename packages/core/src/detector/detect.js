// Detector: combine rule hits and the statistical score into an explained verdict, with ONE
// continuous score per mode so the ROC can sweep the threshold in every configuration (ADR-007).
// Baseline for the pipeline (backlog C-07): refine the explanations once C-03/C-05/C-06 land.
// Pure, runtime-agnostic.

import { scoreRequest } from '../stats/anomaly.js';

/**
 * @typedef {'rules' | 'stats' | 'combined'} DetectMode
 */

const MODES = ['rules', 'stats', 'combined'];

/**
 * Decide whether a request is an attack, and say why.
 *
 * Score by mode (ADR-007): `stats` → the statistical score (−log10 p scale); `combined` →
 * +Infinity when a rule matched, otherwise the statistical score; `rules` → 1 if a rule matched,
 * else 0 (a binary score: its ROC is a single operating point). For `stats` and `combined` the
 * verdict is 'attack' exactly when score ≥ threshold.
 *
 * @param {import('../features/extract.js').AgRequest} request
 * @param {Object} opts
 * @param {import('../rules/engine.js').RuleEngine} [opts.ruleEngine]  required for 'rules'/'combined'
 * @param {import('../stats/model.js').StatModel} [opts.model]       required for 'stats'/'combined'
 * @param {number} [opts.threshold]  on the −log10(p) scale; required for 'stats'/'combined'. No
 *   default on purpose: it is calibrated on legitimate data and swept by the ROC (ADR-009).
 * @param {DetectMode} [opts.mode='combined']
 * @returns {{
 *   verdict: 'attack' | 'legit',
 *   score: number,
 *   statScore: number,
 *   ruleMatched: boolean,
 *   reasons: string[],
 *   detail: { hits: any[], parts: Record<string, number> }
 * }}
 */
export function detect(request, opts) {
  const { ruleEngine, model, threshold, mode = 'combined' } = opts ?? {};
  if (!MODES.includes(mode)) throw new TypeError(`detect: unknown mode '${mode}'`);
  const useRules = mode !== 'stats';
  const useStats = mode !== 'rules';
  if (useRules && !ruleEngine) throw new TypeError(`detect: mode '${mode}' needs a ruleEngine`);
  if (useStats && !model) throw new TypeError(`detect: mode '${mode}' needs a trained model`);
  if (useStats && !Number.isFinite(threshold)) {
    throw new TypeError(`detect: mode '${mode}' needs a finite numeric threshold`);
  }

  /** @type {string[]} */
  const reasons = [];

  let ruleMatched = false;
  /** @type {any[]} */
  let hits = [];
  if (useRules) {
    const r = ruleEngine.inspect(request);
    ruleMatched = r.matched;
    hits = r.hits;
    for (const h of r.hits) reasons.push(`rule ${h.ruleId} (${h.kind}) on "${h.param}"`);
  }

  let statScore = 0;
  /** @type {Record<string, number>} */
  let parts = {};
  if (useStats) {
    const s = scoreRequest(model, request);
    statScore = s.score;
    parts = s.parts;
    if (statScore >= threshold) {
      reasons.push(
        `statistical score ${statScore.toFixed(2)} (${s.top ?? 'none'}) ≥ threshold ${threshold}`,
      );
    }
  }

  let score;
  if (mode === 'rules') score = ruleMatched ? 1 : 0;
  else if (mode === 'stats') score = statScore;
  else score = ruleMatched ? Infinity : statScore;

  const isAttack = mode === 'rules' ? ruleMatched : score >= threshold;

  return {
    verdict: isAttack ? 'attack' : 'legit',
    score,
    statScore,
    ruleMatched,
    reasons,
    detail: { hits, parts },
  };
}
