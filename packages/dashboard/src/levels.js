// Alert levels 0–15 and severities, as in SIEM consoles, with a statistical meaning (ADR-010): a
// statistical alert of level k has anomaly score s = −log10(p) ≥ k, i.e. p ≤ 10^−k (ADR-007);
// level 15 is reserved for signature matches. Display only: the verdict always comes from the
// threshold (AGENTS.md §5), never from the level. Pure: no DOM, tested in Node.

/** Level of a signature (rule) match. */
export const SIGNATURE_LEVEL = 15;

/** Highest level a statistical score can reach, so that 15 always means "a rule matched". */
export const MAX_STAT_LEVEL = 14;

/** Severities from lowest to highest. */
export const SEVERITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

/**
 * @param {{ ruleMatched: boolean, statScore: number }} result  a core `detect()` result
 * @returns {number} 0–15
 */
export function levelOf({ ruleMatched, statScore }) {
  if (ruleMatched) return SIGNATURE_LEVEL;
  if (!(statScore > 0)) return 0; // also catches NaN
  return Math.min(MAX_STAT_LEVEL, Math.floor(statScore));
}

/**
 * Severity band of a level: low 0–1 (p > 0.01), medium 2–3 (p ≤ 0.01), high 4–14 (p ≤ 10^−4),
 * critical 15 (a signature matched).
 * @param {number} level
 * @returns {'low' | 'medium' | 'high' | 'critical'}
 */
export function severityOf(level) {
  if (level >= SIGNATURE_LEVEL) return 'critical';
  if (level >= 4) return 'high';
  if (level >= 2) return 'medium';
  return 'low';
}
