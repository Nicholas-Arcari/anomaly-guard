import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, RuleEngine } from '../src/index.js';

const get = (params, path = '/search') => ({ method: 'GET', path, params });
const engine = new RuleEngine();

// Public textbook examples for the four canonical families (ADR-006), used as known answers.
// They are data only: no payload is executed or sent anywhere.
const CANONICAL = [
  { id: 'SQLI-001', kind: 'sqli', value: "' OR '1'='1" },
  { id: 'SQLI-002', kind: 'sqli', value: '1 OR 1=1' },
  { id: 'SQLI-003', kind: 'sqli', value: 'UNION SELECT NULL,NULL' },
  { id: 'SQLI-004', kind: 'sqli', value: 'SELECT * FROM users' },
  { id: 'SQLI-004', kind: 'sqli', value: 'SELECT username, password FROM users' },
  { id: 'SQLI-005', kind: 'sqli', value: 'SELECT username FROM users WHERE id = 1' },
  { id: 'SQLI-006', kind: 'sqli', value: "'; DROP TABLE users --" },
  { id: 'SQLI-007', kind: 'sqli', value: "admin'--" },
  { id: 'SQLI-007', kind: 'sqli', value: "admin'#" },
  { id: 'XSS-001', kind: 'xss', value: '<script>alert(1)</script>' },
  { id: 'XSS-002', kind: 'xss', value: '<img src=x onerror=alert(1)>' },
  { id: 'XSS-002', kind: 'xss', value: '<svg/onload=alert(1)>' },
  { id: 'XSS-003', kind: 'xss', value: 'javascript:alert(1)' },
  { id: 'TRAV-001', kind: 'traversal', value: '../../etc/passwd' },
  { id: 'TRAV-001', kind: 'traversal', value: '..\\..\\windows\\win.ini' },
  { id: 'TRAV-002', kind: 'traversal', value: '/etc/passwd' },
  { id: 'TRAV-002', kind: 'traversal', value: 'C:\\Windows\\win.ini' },
  { id: 'CMDI-001', kind: 'cmdi', value: '; cat /etc/passwd' },
  { id: 'CMDI-001', kind: 'cmdi', value: '| whoami' },
  { id: 'CMDI-001', kind: 'cmdi', value: '`id`' },
  { id: 'CMDI-001', kind: 'cmdi', value: '&& /bin/id' },
  { id: 'CMDI-002', kind: 'cmdi', value: '$(cat /etc/passwd)' },
  { id: 'CMDI-002', kind: 'cmdi', value: '$(/bin/id)' },
];

// Legitimate values that share surface features with attacks but contain no signature.
const BENIGN = [
  ['ordinary words', 'red shoes'],
  ['apostrophe', "O'Brien"],
  ['long prose', "Please check the order: it's fine, 10 items."],
  ['non-Latin text', '東京の店舗は渋谷にあります'],
  ['email address', 'user@example.com'],
  ['URL', 'https://example.com/item?id=42&sort=price'],
  ['natural-language select', 'select a color from the list'],
  ['hashtag', 'page #2'],
  ['double hyphen in prose', 'well--known'],
  ['quoted conjunction', 'She said "and then"'],
  ['plain comparison', 'price = 10'],
  ['semicolon in prose', "I can't attend; please reschedule"],
  ['empty value', ''],
];

test('DEFAULT_RULES targets exactly the four canonical families, with unique ids', () => {
  const kinds = [...new Set(DEFAULT_RULES.map((r) => r.kind))].sort();
  assert.deepEqual(kinds, ['cmdi', 'sqli', 'traversal', 'xss']);
  assert.equal(new Set(DEFAULT_RULES.map((r) => r.id)).size, DEFAULT_RULES.length);
});

test('every default rule has a canonical known-answer example', () => {
  const covered = new Set(CANONICAL.map((c) => c.id));
  assert.deepEqual([...covered].sort(), DEFAULT_RULES.map((r) => r.id).sort());
});

for (const { id, kind, value } of CANONICAL) {
  test(`canonical ${kind}: ${id} flags ${JSON.stringify(value)}`, () => {
    const result = engine.inspect(get({ probe: value }));
    assert.equal(result.matched, true);
    assert.ok(
      result.hits.some((h) => h.ruleId === id && h.kind === kind && h.param === 'probe'),
      `expected ${id} on "probe", got ${JSON.stringify(result.hits)}`,
    );
  });
}

for (const [name, value] of BENIGN) {
  test(`legitimate input does not match: ${name}`, () => {
    const result = engine.inspect(get({ probe: value }));
    assert.equal(result.matched, false, JSON.stringify(result.hits));
  });
}

test('a hit names the rule, the family and the parameter', () => {
  const [hit] = engine.inspect(get({ u: "' OR '1'='1" })).hits;
  assert.deepEqual(hit, { ruleId: 'SQLI-001', kind: 'sqli', param: 'u' });
});

test('reports the parameter that hit, not the whole request', () => {
  const result = engine.inspect(get({ q: 'red shoes', id: "' OR '1'='1", sort: 'price' }));
  assert.equal(result.matched, true);
  assert.ok(result.hits.length > 0);
  for (const hit of result.hits) assert.equal(hit.param, 'id');
});

test('keeps every matching rule, not just the first', () => {
  const result = engine.inspect(get({ q: "' UNION SELECT username, password FROM users--" }));
  const ruleIds = result.hits.map((h) => h.ruleId);
  assert.ok(ruleIds.includes('SQLI-003'));
  assert.ok(ruleIds.includes('SQLI-004'));
});

test('missing, null or empty params are safe and unmatched', () => {
  const empty = { matched: false, hits: [] };
  assert.deepEqual(engine.inspect({ method: 'GET', path: '/x' }), empty);
  assert.deepEqual(engine.inspect({ method: 'GET', path: '/x', params: {} }), empty);
  assert.deepEqual(engine.inspect({ method: 'GET', path: '/x', params: null }), empty);
  assert.deepEqual(engine.inspect(get({ id: 42 })), empty);
});

test('inspect is deterministic across calls, even with a global custom rule', () => {
  const custom = new RuleEngine([{ id: 'TEST-001', kind: 'test', pattern: /evil/g }]);
  const request = get({ q: 'evil' });
  assert.equal(custom.inspect(request).matched, true);
  assert.equal(custom.inspect(request).matched, true);
});

test('adding a benign parameter never removes an existing hit', () => {
  const one = engine.inspect(get({ q: "' OR '1'='1" }));
  const two = engine.inspect(get({ q: "' OR '1'='1", page: '2' }));
  assert.deepEqual(two.hits, one.hits);
});

test('canonical rules do not decode or target obfuscated forms', () => {
  assert.equal(engine.inspect(get({ q: '%27%20OR%20%271%27%3D%271' })).matched, false);
  assert.equal(engine.inspect(get({ q: '%2e%2e%2fetc%2fpasswd' })).matched, false);
});
