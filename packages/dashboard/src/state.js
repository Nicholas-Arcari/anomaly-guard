// Experiment settings live in the page URL (ADR-010), e.g.
//   ?seed=42&mode=combined&threshold=1&prevalence=0.1&size=1000
// Every page of the multi-page app rebuilds the same experiment from them (same seed → same data,
// standards §3), links carry them from page to page, and nothing needs browser storage — which a
// sandboxed iframe in a portfolio does not have. Pure: no DOM, tested in Node.

/** @typedef {'combined' | 'stats' | 'rules'} Mode */

/**
 * @typedef {Object} ExperimentState
 * @property {number} seed        dataset seed (32-bit unsigned integer)
 * @property {Mode} mode          detector mode (core `detect`)
 * @property {number} threshold   on the −log10(p) scale (ADR-007)
 * @property {number} prevalence  share of attacks in the test split, 0–1
 * @property {number} size        number of test requests
 */

/** @type {readonly Mode[]} */
export const MODES = Object.freeze(['combined', 'stats', 'rules']);

/** The settings, in the order they appear in a URL. */
export const STATE_KEYS = Object.freeze(['seed', 'mode', 'threshold', 'prevalence', 'size']);

/** @type {Readonly<ExperimentState>} */
export const DEFAULTS = Object.freeze({
  seed: 42,
  mode: 'combined',
  threshold: 1,
  prevalence: 0.1,
  size: 1000,
});

/** Accepted ranges: a value outside them, or not a number, falls back to its default. */
export const LIMITS = Object.freeze({
  seed: { min: 0, max: 4294967295, integer: true },
  threshold: { min: 0, max: 50, integer: false },
  prevalence: { min: 0, max: 1, integer: false },
  size: { min: 100, max: 5000, integer: true },
});

/**
 * @param {string | null} raw
 * @param {'seed' | 'threshold' | 'prevalence' | 'size'} key
 * @returns {number}
 */
function readNumber(raw, key) {
  if (raw === null || raw.trim() === '') return DEFAULTS[key];
  const x = Number(raw);
  const { min, max, integer } = LIMITS[key];
  if (!Number.isFinite(x) || x < min || x > max || (integer && !Number.isInteger(x))) {
    return DEFAULTS[key];
  }
  return x;
}

/**
 * Read the settings from a query string; anything missing or invalid takes its default.
 * @param {string | URLSearchParams} search  e.g. `location.search`
 * @returns {ExperimentState}
 */
export function parseState(search) {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const mode = /** @type {Mode} */ (q.get('mode'));
  return {
    seed: readNumber(q.get('seed'), 'seed'),
    mode: MODES.includes(mode) ? mode : DEFAULTS.mode,
    threshold: readNumber(q.get('threshold'), 'threshold'),
    prevalence: readNumber(q.get('prevalence'), 'prevalence'),
    size: readNumber(q.get('size'), 'size'),
  };
}

/**
 * The query string of a state, keys in a fixed order (no leading '?').
 * @param {ExperimentState} state
 * @returns {string} e.g. 'seed=42&mode=combined&threshold=1&prevalence=0.1&size=1000'
 */
export function toQuery(state) {
  const q = new URLSearchParams();
  for (const key of STATE_KEYS) q.set(key, String(state[key]));
  return q.toString();
}

/**
 * `href` with the experiment settings in its query string. Its other parameters and its #hash
 * are kept; `extra` sets page parameters (null or undefined removes one). Relative links stay
 * relative.
 * @param {string} href  e.g. './events.html' or './events.html?show=alerts#top'
 * @param {ExperimentState} state
 * @param {Record<string, string | number | null | undefined>} [extra]
 * @returns {string}
 */
export function withState(href, state, extra = {}) {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const q = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '');
  for (const key of STATE_KEYS) q.set(key, String(state[key]));
  for (const [key, value] of Object.entries(extra)) {
    if (value === null || value === undefined) q.delete(key);
    else q.set(key, String(value));
  }
  return `${path}?${q.toString()}${hash}`;
}
