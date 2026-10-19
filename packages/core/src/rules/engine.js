// Rule engine: signature / regex checks over the raw parameter values.
// Starter implementation — extend the ruleset and reporting (backlog B-01).
// Rules are DATA: each is a regex plus metadata. We only MATCH payloads, never execute them
// (ADR-001). Pure, runtime-agnostic.

/**
 * @typedef {Object} Rule
 * @property {string} id       stable id, e.g. 'SQLI-001'
 * @property {string} kind     attack family: 'sqli' | 'xss' | 'traversal' | 'cmdi' | ...
 * @property {RegExp} pattern  matched against each parameter value (never executed)
 */

/**
 * Starter ruleset. Deliberately small and obvious: the point of the project is that these
 * signatures are precise on known attacks but blind to novel/obfuscated ones (the statistics
 * are meant to cover that gap). Add coverage in B-01; keep each rule a plain pattern.
 * @type {Rule[]}
 */
export const DEFAULT_RULES = [
  { id: 'SQLI-001', kind: 'sqli', pattern: /('|%27)\s*(or|and)\s/i },
  { id: 'SQLI-002', kind: 'sqli', pattern: /\b(union\s+select|select\s+.*\bfrom\b)/i },
  { id: 'SQLI-003', kind: 'sqli', pattern: /(--|#|\/\*)/ },
  { id: 'XSS-001', kind: 'xss', pattern: /<\s*script\b/i },
  { id: 'XSS-002', kind: 'xss', pattern: /on\w+\s*=/i },
  { id: 'TRAV-001', kind: 'traversal', pattern: /(\.\.\/|\.\.\\|%2e%2e)/i },
  { id: 'CMDI-001', kind: 'cmdi', pattern: /[;&|`]\s*(cat|ls|whoami|id|curl|wget)\b/i },
];

/**
 * A rule engine over a fixed ruleset.
 */
export class RuleEngine {
  /** @param {Rule[]} [rules] */
  constructor(rules = DEFAULT_RULES) {
    /** @type {Rule[]} */
    this.rules = rules;
  }

  /**
   * Match every parameter value against every rule.
   * @param {import('../features/extract.js').AgRequest} request
   * @returns {{ matched: boolean, hits: { ruleId: string, kind: string, param: string }[] }}
   */
  inspect(request) {
    const params = request.params ?? {};
    /** @type {{ ruleId: string, kind: string, param: string }[]} */
    const hits = [];
    for (const [name, value] of Object.entries(params)) {
      const v = String(value);
      for (const rule of this.rules) {
        // .test on a fresh value; patterns are not global, so no lastIndex state to reset.
        if (rule.pattern.test(v)) {
          hits.push({ ruleId: rule.id, kind: rule.kind, param: name });
        }
      }
    }
    return { matched: hits.length > 0, hits };
  }
}
