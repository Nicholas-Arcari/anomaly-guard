// Character-distribution signal (C-03) — the headline method (Kruegel & Vigna 2003, ADR-008,
// methods.md §4). The χ² survival function is computed here by hand: `core` uses no stats library.
// The dataset-level test of homogeneity (C-08, methods.md §4b) belongs here too. Pure,
// runtime-agnostic.
//
// Building blocks: extractFeatures (../features/extract.js) gives each parameter's observed class
// counts; paramKey and pToScore (./model.js) give the model key and the score scale.

/**
 * HEADLINE METHOD — chi-square score on the character distribution (methods.md §4, ADR-008).
 * For each parameter value with N characters: observed class counts O_i against expected
 * E_i = N · p̂_i, with Laplace-smoothed p̂_i = (c_i + 1) / (C + k) from the pair's training counts
 * (the pooled counts if the pair is unseen), so E_i > 0 always. χ² = Σ (O_i − E_i)² / E_i with
 * df = k − 1 = 6; no class merging, no Yates correction. The p-value from the χ²(6) survival
 * function is NOMINAL (the E_i are small), so it is used only as a score, s = −log10(p), computed
 * in log space so it cannot underflow. Report the most anomalous parameter.
 *
 * @param {import('./model.js').StatModel} model
 * @param {import('../features/extract.js').AgRequest} request
 * @returns {{ chiSquare: number, df: number, pValue: number, score: number, param: string | null }}
 */
// eslint-disable-next-line no-unused-vars
export function chiSquareScore(model, request) {
  // TODO(C-03): implement the smoothed chi-square score (ADR-008, methods.md §4).
  throw new Error('chiSquareScore not implemented yet (backlog C-03)');
}
