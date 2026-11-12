import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, makeLegitRequest, makeAttackRequest, ATTACK_PAYLOADS } from '../src/index.js';

const shape = ({ method, path, params }) => `${method} ${path} ${Object.keys(params).sort()}`;
const ALL_PAYLOADS = new Set(
  Object.values(ATTACK_PAYLOADS).flatMap((list) => list.map((e) => e.payload)),
);

test('targeted families have distinct canonical examples and short mimicry cases', () => {
  for (const kind of ['sqli', 'xss', 'traversal', 'cmdi']) {
    const entries = ATTACK_PAYLOADS[kind].filter((entry) => entry.variant === 'canonical');
    const count = kind === 'sqli' ? 8 : 6;
    assert.equal(entries.length, count, kind);
    assert.equal(new Set(entries.map((entry) => entry.payload)).size, count, kind);
    assert.ok(entries.every((entry) => entry.payload.length > 0));
  }
  for (const payload of ['1 OR 1=1', "admin'--"]) {
    assert.ok(
      ATTACK_PAYLOADS.sqli.some(
        (entry) => entry.payload === payload && entry.variant === 'canonical',
      ),
    );
  }
});

test('the fixed novel families are labelled by construction', () => {
  const novel = ['oversized', 'template', 'ldap', 'nosql', 'crlf'];
  assert.deepEqual(Object.keys(ATTACK_PAYLOADS), ['sqli', 'xss', 'traversal', 'cmdi', ...novel]);
  for (const kind of novel) {
    assert.ok(ATTACK_PAYLOADS[kind].every((entry) => entry.variant === 'novel'));
  }
  for (const kind of ['sqli', 'xss', 'traversal', 'cmdi']) {
    assert.ok(ATTACK_PAYLOADS[kind].every((entry) => entry.variant !== 'novel'));
  }
  assert.equal(ATTACK_PAYLOADS.oversized[0].payload.length, 1024);
  assert.equal(ATTACK_PAYLOADS.template[0].payload, '{{7*7}}');
  assert.equal(ATTACK_PAYLOADS.crlf[0].payload, '\r\nX-Injected: test');
});

test('obfuscated examples cover the documented transformations', () => {
  const obfuscated = Object.values(ATTACK_PAYLOADS)
    .flat()
    .filter((entry) => entry.variant === 'obfuscated');
  for (const payload of [
    'UN/**/ION SELECT NULL,NULL',
    'uNiOn SeLeCt NULL,NULL',
    'UNION\tSELECT NULL,NULL',
    'UNION\nSELECT NULL,NULL',
    "<script>window['al'+'ert'](1)</script>",
    '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">',
  ]) {
    assert.ok(
      obfuscated.some((entry) => entry.payload === payload),
      payload,
    );
  }
  for (const [kind, original] of [
    ['xss', '<script>alert(1)</script>'],
    ['traversal', '../../etc/passwd'],
  ]) {
    const encoded = ATTACK_PAYLOADS[kind].find((entry) => entry.payload.startsWith('%')).payload;
    const wire = encodeURIComponent(encoded);
    assert.equal(decodeURIComponent(wire), encoded); // value after the server's single pass
    assert.equal(decodeURIComponent(encoded), original);
  }
});

test('every payload can replace either parameter without changing the request shape', () => {
  const families = Object.keys(ATTACK_PAYLOADS);
  for (const kind of families) {
    for (const entry of ATTACK_PAYLOADS[kind]) {
      for (const paramIndex of [0, 1]) {
        const seed = 17;
        const base = makeLegitRequest(createRng(seed)).request;
        const random = createRng(seed);
        let stage = 0;
        const rng = {
          ...random,
          pick(items) {
            const selected = random.pick(items);
            if (
              stage === 0 &&
              items.length === families.length &&
              items.every((v, i) => v === families[i])
            ) {
              stage = 1;
              return kind;
            }
            if (stage === 1) {
              assert.equal(items, ATTACK_PAYLOADS[kind]);
              stage = 2;
              return entry;
            }
            if (stage === 2) {
              stage = 3;
              return items[paramIndex];
            }
            return selected;
          },
        };
        const attack = makeAttackRequest(rng);
        const param = Object.keys(base.params)[paramIndex];
        assert.equal(stage, 3);
        assert.equal(attack.label, 'attack');
        assert.equal(attack.kind, kind);
        assert.equal(attack.variant, entry.variant);
        assert.notEqual(base.params[param], entry.payload);
        assert.deepEqual(attack.request, {
          ...base,
          params: { ...base.params, [param]: entry.payload },
        });
      }
    }
  }
});

test('seeded attack sampling reflects the assumed family and payload probabilities', () => {
  const rng = createRng(42);
  const samples = Array.from({ length: 8000 }, () => makeAttackRequest(rng));
  for (const kind of Object.keys(ATTACK_PAYLOADS)) {
    const share = samples.filter((sample) => sample.kind === kind).length / samples.length;
    assert.ok(Math.abs(share - 1 / 9) < 0.02, `${kind}: ${share}`);
  }
  const payload = ATTACK_PAYLOADS.sqli[0].payload;
  const share =
    samples.filter(
      (sample) => sample.kind === 'sqli' && Object.values(sample.request.params).includes(payload),
    ).length / samples.length;
  assert.ok(Math.abs(share - 1 / 108) < 0.005, `SQL example: ${share}`);
  for (const [kind, expected] of [
    ['sqli', 8 / 12],
    ['xss', 6 / 9],
    ['traversal', 6 / 7],
    ['cmdi', 1],
  ]) {
    const family = samples.filter((sample) => sample.kind === kind);
    const canonicalShare =
      family.filter((sample) => sample.variant === 'canonical').length / family.length;
    assert.ok(Math.abs(canonicalShare - expected) < 0.05, `${kind}: ${canonicalShare}`);
  }
  const novelShare = samples.filter((sample) => sample.variant === 'novel').length / samples.length;
  assert.ok(Math.abs(novelShare - 5 / 9) < 0.02, `novel: ${novelShare}`);
});

test('makeAttackRequest: keeps the shape of legitimate traffic (ADR-006)', () => {
  // The attacker controls values, not the schema: every attack must look like a legit request
  // (same method, path and parameter names), or the parameter name alone would give it away.
  const legitRng = createRng(1);
  const legitShapes = new Set(
    Array.from({ length: 3000 }, () => shape(makeLegitRequest(legitRng).request)),
  );
  const rng = createRng(2);
  for (let i = 0; i < 300; i++) {
    const { request } = makeAttackRequest(rng);
    assert.ok(legitShapes.has(shape(request)), `unexpected shape: ${shape(request)}`);
  }
});

test('makeAttackRequest: replaces exactly one parameter value with a payload', () => {
  const rng = createRng(3);
  for (let i = 0; i < 300; i++) {
    const { request } = makeAttackRequest(rng);
    const injected = Object.values(request.params).filter((v) => ALL_PAYLOADS.has(v));
    assert.equal(injected.length, 1);
  }
});

test('variants: legit samples are typical; attack variants match the payload table', () => {
  const rng = createRng(4);
  for (let i = 0; i < 300; i++) {
    assert.equal(makeLegitRequest(rng).variant, 'typical');
    const attack = makeAttackRequest(rng);
    const payload = Object.values(attack.request.params).find((v) => ALL_PAYLOADS.has(v));
    const entry = ATTACK_PAYLOADS[attack.kind].find((e) => e.payload === payload);
    assert.ok(entry, `payload not in family ${attack.kind}`);
    assert.equal(attack.variant, entry.variant);
    assert.ok(['canonical', 'obfuscated', 'novel'].includes(attack.variant));
  }
});
