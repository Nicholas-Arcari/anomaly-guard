// Feature extraction: turn one request into a flat numeric record.
// This is the ONLY place that reads the raw request shape; detectors and the report consume
// the record (project-structure.md §3, methods.md §2). Pure, runtime-agnostic.

import { charClassCounts, shannonEntropy, CHAR_CLASSES } from '../stats/entropy.js';

/**
 * A simulated request. `params` collects every user-controlled string value (from the query
 * string and the body) keyed by name — these are what an attacker controls and what we measure.
 * Values are what the application sees AFTER the server's single URL-decoding pass, as Express
 * gives `req.query` / `req.body` (ADR-006): a value that still contains `%xx` was double-encoded
 * by the sender, which is what the `hasEncoding` feature flags.
 * @typedef {Object} AgRequest
 * @property {string} method   HTTP method, e.g. 'GET' | 'POST'
 * @property {string} path     URL path, e.g. '/search'
 * @property {Record<string, string>} params  user-controlled parameter values
 */

/** Methods we encode as an ordinal feature; anything else is OTHER. */
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** @param {string} s @returns {boolean} true if the string contains a percent-encoded byte */
function hasPercentEncoding(s) {
  return /%[0-9a-fA-F]{2}/.test(s);
}

/**
 * Per-parameter features for one value.
 * @param {string} name
 * @param {string} value
 * @returns {{ name: string, length: number, entropy: number, classCounts: Record<string, number>, classRatios: Record<string, number>, hasEncoding: boolean }}
 */
export function paramFeatures(name, value) {
  const v = String(value);
  const len = v.length;
  const counts = charClassCounts(v);
  /** @type {Record<string, number>} */
  const classRatios = {};
  for (const cls of CHAR_CLASSES) classRatios[cls] = len === 0 ? 0 : counts[cls] / len;
  return {
    name,
    length: len,
    entropy: shannonEntropy(v),
    classCounts: counts, // observed counts O_i for the chi-square score (ADR-008)
    classRatios,
    hasEncoding: hasPercentEncoding(v),
  };
}

/**
 * Extract a flat feature record from a request. The whole payload is the concatenation of the
 * parameter values; aggregate features are computed over it, plus per-parameter detail.
 * @param {AgRequest} request
 * @returns {{
 *   method: string,
 *   methodOrdinal: number,
 *   path: string,
 *   paramCount: number,
 *   totalLength: number,
 *   maxParamLength: number,
 *   entropy: number,
 *   classCounts: Record<string, number>,
 *   classRatios: Record<string, number>,
 *   hasEncoding: boolean,
 *   params: ReturnType<typeof paramFeatures>[]
 * }}
 */
export function extractFeatures(request) {
  const method = String(request.method ?? 'GET').toUpperCase();
  const params = request.params ?? {};
  const names = Object.keys(params);
  const payload = names.map((n) => String(params[n])).join('');

  const perParam = names.map((n) => paramFeatures(n, String(params[n])));
  const classCounts = charClassCounts(payload);
  const totalLength = payload.length;
  /** @type {Record<string, number>} */
  const classRatios = {};
  for (const cls of CHAR_CLASSES)
    classRatios[cls] = totalLength === 0 ? 0 : classCounts[cls] / totalLength;

  return {
    method,
    methodOrdinal: METHODS.indexOf(method), // -1 = OTHER
    path: String(request.path ?? '/'),
    paramCount: names.length,
    totalLength,
    maxParamLength: perParam.reduce((m, p) => Math.max(m, p.length), 0),
    entropy: shannonEntropy(payload),
    classCounts,
    classRatios,
    hasEncoding: hasPercentEncoding(payload),
    params: perParam,
  };
}
