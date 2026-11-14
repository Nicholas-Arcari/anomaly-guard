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

export { trainStatModel, paramKey, pToScore } from './stats/model.js';
export { lengthZScore, lengthScore } from './stats/length.js';
export { chiSquareScore } from './stats/chisquare.js';
export { scoreRequest } from './stats/anomaly.js';

export { detect } from './detector/detect.js';
