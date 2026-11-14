// Rule engine: signature / regex checks over the raw parameter values.
// Canonical signatures for the four targeted families only (ADR-006): sqli, xss, traversal,
// cmdi. We only MATCH payloads, never execute or decode them (ADR-001, ADR-006).
// Pure, runtime-agnostic.

/**
 * @typedef {Object} Rule
 * @property {string} id       stable id, e.g. 'SQLI-001'
 * @property {string} kind     attack family: 'sqli' | 'xss' | 'traversal' | 'cmdi'
 * @property {RegExp} pattern  matched against each parameter value (never executed)
 */

/**
 * Canonical ruleset (backlog B-01). Deliberately blind to obfuscated and novel payloads:
 * signatures describe textbook forms of the four families the project targets, written without
 * looking at the A-04 payload pool (ADR-006). They are not normalised: a value is matched as the
 * application sees it after the server's one URL-decoding pass, so leftover %xx stays obfuscated.
 * Each rule is plain data; `inspect` reports which one hit.
 * @type {Rule[]}
 */
export const DEFAULT_RULES = [
  // SQL injection: quote/boolean tautology, bare numeric tautology, UNION SELECT, SELECT ... FROM.
  {
    id: 'SQLI-001',
    kind: 'sqli',
    pattern: /['"]\s*(?:or|and)\b[\s\S]{0,32}(?:=|<>|!=|<=|>=|<|>|--|#|\/\*)/i,
  },
  {
    id: 'SQLI-002',
    kind: 'sqli',
    pattern:
      /\b(?:or|and)\b\s+(?:['"][^'"]*['"]|\d+(?:\.\d+)?)\s*(?:=|<>|!=|<=|>=|<|>)\s*(?:['"][^'"]*['"]|\d+(?:\.\d+)?)/i,
  },
  { id: 'SQLI-003', kind: 'sqli', pattern: /\bunion(?:\s+all)?\s+select\b/i },
  {
    id: 'SQLI-004',
    kind: 'sqli',
    pattern: /\bselect\s+(?:\*|[\w"`]+(?:\s*,\s*[\w"`]+)+)\s+from\b/i,
  },
  {
    id: 'SQLI-005',
    kind: 'sqli',
    pattern: /\bselect\s+[\w"`]+\s+from\s+[\w"`]+\s+where\b/i,
  },
  {
    id: 'SQLI-006',
    kind: 'sqli',
    pattern: /;\s*(?:drop|delete|insert|update|alter|create|truncate|exec(?:ute)?|grant|revoke)\b/i,
  },
  { id: 'SQLI-007', kind: 'sqli', pattern: /(?:['";]--|['";]#(?=\s|$)|['";]\/\*)/ },
  // XSS: script tag, an event handler inside a tag, javascript: URI.
  { id: 'XSS-001', kind: 'xss', pattern: /<\s*script\b/i },
  { id: 'XSS-002', kind: 'xss', pattern: /<[^>]*[\s/]on[a-z]{3,}\s*=/i },
  { id: 'XSS-003', kind: 'xss', pattern: /\bjavascript\s*:/i },
  // Path traversal: dot-dot sequence or direct access to a sensitive file.
  { id: 'TRAV-001', kind: 'traversal', pattern: /\.\.[\\/]/ },
  {
    id: 'TRAV-002',
    kind: 'traversal',
    pattern:
      /(?:^|[\\/])(?:etc[\\/](?:passwd|shadow|hosts)|(?:windows|winnt)[\\/](?:win\.ini|system32)|boot\.ini|proc[\\/]self[\\/]environ)\b/i,
  },
  // Command injection: shell separator followed by a command, or $(command).
  {
    id: 'CMDI-001',
    kind: 'cmdi',
    pattern:
      /[;&|`\n]\s*(?:[\\/]?[\w.-]+[\\/])*(?:cat|ls|whoami|id|uname|pwd|curl|wget|nc|netcat|bash|sh|zsh|ping|nslookup|dig|python[0-9.]*|perl|ruby|php|rm|mv|cp|chmod|chown|echo|sleep|touch|mkdir|env|printenv|hostname|ifconfig|ipconfig|powershell|cmd)\b/i,
  },
  {
    id: 'CMDI-002',
    kind: 'cmdi',
    pattern:
      /\$\(\s*(?:[\\/]?[\w.-]+[\\/])*(?:cat|ls|whoami|id|uname|pwd|curl|wget|nc|netcat|bash|sh|zsh|ping|nslookup|dig|python[0-9.]*|perl|ruby|php|rm|mv|cp|chmod|chown|echo|sleep|touch|mkdir|env|printenv|hostname|ifconfig|ipconfig|powershell|cmd)\b/i,
  },
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
    const params = request?.params ?? {};
    /** @type {{ ruleId: string, kind: string, param: string }[]} */
    const hits = [];
    for (const [name, value] of Object.entries(params)) {
      const v = String(value);
      for (const rule of this.rules) {
        // Reset state in case a custom rule uses /g or /y; default rules do not.
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(v)) {
          hits.push({ ruleId: rule.id, kind: rule.kind, param: name });
        }
      }
    }
    return { matched: hits.length > 0, hits };
  }
}
