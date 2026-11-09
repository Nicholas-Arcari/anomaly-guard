import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, makeLegitRequest, makeAttackRequest, ATTACK_PAYLOADS } from '../src/index.js';

const shape = ({ method, path, params }) => `${method} ${path} ${Object.keys(params).sort()}`;
const ALL_PAYLOADS = new Set(
  Object.values(ATTACK_PAYLOADS).flatMap((list) => list.map((e) => e.payload)),
);

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
