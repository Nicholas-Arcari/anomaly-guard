// Combined statistical score (C-06): every signal reports s = −log10(p) on the common scale
// (ADR-007) and the request's score is their maximum. Thresholds are applied by the caller so the
// ROC can sweep them (standards §3, methods.md). Pure, runtime-agnostic.
//
// Signals: length.js (baseline in place), chisquare.js (C-03), outliers.js (C-05).

import { lengthScore } from './length.js';

/**
 * Combine the statistical signals into one anomaly score (ADR-007): every part is on the
 * −log10(p) scale and the score is their maximum; `top` names the part that produced it.
 * Higher = more anomalous. The caller applies the threshold.
 * @param {import('./model.js').StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ score: number, parts: Record<string, number>, top: string | null }}
 */
export function scoreRequest(model, request) {
  /** @type {Record<string, number>} */
  const parts = { length: lengthScore(model, request).score };
  // TODO(C-06): add parts.chiSquare (C-03) and the outlier parts (C-05), each as −log10(p).
  let score = 0;
  /** @type {string | null} */
  let top = null;
  for (const [name, s] of Object.entries(parts)) {
    if (s > score) {
      score = s;
      top = name;
    }
  }
  return { score, parts, top };
}
