// Detector: combine rule hits and the statistical anomaly score into an explained verdict.
// Baseline implementation for the pipeline (backlog C-07); refine the combination strategy and
// the explanation once C-03/C-05/C-06 land. Pure, runtime-agnostic.

import { scoreRequest } from '../stats/anomaly.js';

/**
 * @typedef {'rules' | 'stats' | 'combined'} DetectMode
 */

/**
 * Decide whether a request is an attack, and say why.
 *
 * @param {import('../features/extract.js').AgRequest} request
 * @param {Object} opts
 * @param {import('../rules/engine.js').RuleEngine} [opts.ruleEngine]  rule engine (required for 'rules'/'combined')
 * @param {import('../stats/anomaly.js').StatModel} [opts.model]       trained model (required for 'stats'/'combined')
 * @param {number} [opts.threshold=3]  statistical score threshold (e.g. z ≥ 3). Swept by the ROC.
 * @param {DetectMode} [opts.mode='combined']
 * @returns {{
 *   verdict: 'attack' | 'legit',
 *   score: number,
 *   ruleMatched: boolean,
 *   reasons: string[],
 *   detail: { hits: any[], parts: Record<string, number> }
 * }}
 */
export function detect(request, opts) {
  const { ruleEngine, model, threshold = 3, mode = 'combined' } = opts ?? {};
  /** @type {string[]} */
  const reasons = [];

  let ruleMatched = false;
  /** @type {any[]} */
  let hits = [];
  if ((mode === 'rules' || mode === 'combined') && ruleEngine) {
    const r = ruleEngine.inspect(request);
    ruleMatched = r.matched;
    hits = r.hits;
    for (const h of r.hits) reasons.push(`rule ${h.ruleId} (${h.kind}) on "${h.param}"`);
  }

  let score = 0;
  /** @type {Record<string, number>} */
  let parts = {};
  let statFlag = false;
  if ((mode === 'stats' || mode === 'combined') && model) {
    const s = scoreRequest(model, request);
    score = s.score;
    parts = s.parts;
    statFlag = score >= threshold;
    if (statFlag) reasons.push(`statistical score ${score.toFixed(2)} ≥ threshold ${threshold}`);
  }

  const isAttack =
    mode === 'rules' ? ruleMatched : mode === 'stats' ? statFlag : ruleMatched || statFlag;

  return {
    verdict: isAttack ? 'attack' : 'legit',
    score,
    ruleMatched,
    reasons,
    detail: { hits, parts },
  };
}
