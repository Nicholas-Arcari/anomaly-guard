// Public surface of @anomaly-guard/core. Import from here, not from internal paths.

export {
  shannonEntropy,
  charClassCounts,
  charHistogram,
  classifyChar,
  CHAR_CLASSES,
  SPECIAL_CHARS,
} from './stats/entropy.js';

export { extractFeatures, paramFeatures } from './features/extract.js';

export { RuleEngine, DEFAULT_RULES } from './rules/engine.js';

export {
  trainStatModel,
  scoreRequest,
  paramKey,
  pToScore,
  lengthZScore,
  lengthScore,
  chiSquareScore, // stub — backlog C-03
} from './stats/anomaly.js';

export { detect } from './detector/detect.js';
