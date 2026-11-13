// Public surface of @anomaly-guard/experiments (Node only, ADR-009).

export {
  runExperiment,
  runSeed,
  validateConfig,
  bootstrapSeedFor,
  DEFAULT_CONFIG,
  MODES,
} from './run.js';
export { formatReport } from './report.js';
export { provenance } from './provenance.js';
export { parseCliArgs, runCli } from './cli.js';
