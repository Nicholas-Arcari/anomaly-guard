// Command line for the D-04 experiment, run from the repository root:
//   npm run experiments                      # the ADR-009 configuration (20 seeds, ~1.5 minutes)
//   npm run experiments -- --seeds 3 --calibration 2000 --test 1000   # a quick check
// It writes results/<date>-<commit>/results.json (every number, seed by seed) and report.md (the
// tables), and prints where they are. results/ is git-ignored: anyone can regenerate it from the
// seeds and the commit. Node only (ADR-009).

import { parseArgs } from 'node:util';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runExperiment, validateConfig, DEFAULT_CONFIG, MODES } from './run.js';
import { formatReport } from './report.js';
import { provenance } from './provenance.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export const USAGE = `Usage: npm run experiments -- [options]

  --seeds <n>          number of seeds, at least 2 (default 20; ADR-009 asks for 20 or more)
  --first-seed <s>     first seed; the seeds are s, s+1, … (default 1)
  --train <n>          legitimate training requests per seed (default 2000)
  --calibration <n>    legitimate calibration requests per seed (default 10000)
  --test <n>           test requests per seed (default 5000)
  --prevalence <p>     attack share of the test split (default 0.1)
  --hard-share <h>     share of the legitimate test requests that are hard cases (default 0.05)
  --targets <list>     target false-positive rates, comma-separated (default 0.01,0.001)
  --resamples <n>      bootstrap resamples for the AUC interval (default 1000)
  --out <dir>          output directory (default results/<date>-<commit>)
  --help               show this help`;

const OPTIONS = /** @type {const} */ ({
  seeds: { type: 'string' },
  'first-seed': { type: 'string' },
  train: { type: 'string' },
  calibration: { type: 'string' },
  test: { type: 'string' },
  prevalence: { type: 'string' },
  'hard-share': { type: 'string' },
  targets: { type: 'string' },
  resamples: { type: 'string' },
  out: { type: 'string' },
  help: { type: 'boolean' },
});

/**
 * @param {string[]} argv  the arguments after the script name
 * @returns {{ help: true } | { help: false, config: import('./run.js').ExperimentConfig, out?: string }}
 * @throws {TypeError} on an unknown option; {RangeError} on a bad value
 */
export function parseCliArgs(argv) {
  const { values } = parseArgs({ args: argv, options: OPTIONS, strict: true });
  if (values.help) return { help: true };
  const toNumber = (text, name) => {
    const value = Number(text);
    if (text.trim() === '' || !Number.isFinite(value)) {
      throw new RangeError(`--${name}: '${text}' is not a number`);
    }
    return value;
  };
  const option = (name, fallback) =>
    values[name] === undefined ? fallback : toNumber(values[name], name);

  const count = option('seeds', DEFAULT_CONFIG.seeds.length);
  if (!Number.isInteger(count) || count < 2) throw new RangeError('--seeds: an integer ≥ 2');
  const firstSeed = option('first-seed', DEFAULT_CONFIG.seeds[0]);
  const config = validateConfig({
    seeds: Array.from({ length: count }, (_, i) => firstSeed + i),
    trainSize: option('train', DEFAULT_CONFIG.trainSize),
    calibrationSize: option('calibration', DEFAULT_CONFIG.calibrationSize),
    testSize: option('test', DEFAULT_CONFIG.testSize),
    prevalence: option('prevalence', DEFAULT_CONFIG.prevalence),
    hardShare: option('hard-share', DEFAULT_CONFIG.hardShare),
    targets:
      values.targets === undefined
        ? [...DEFAULT_CONFIG.targets]
        : values.targets.split(',').map((t) => toNumber(t, 'targets')),
    resamples: option('resamples', DEFAULT_CONFIG.resamples),
  });
  return { help: false, config, out: values.out };
}

/**
 * Configurations that run but should not be reported as they are.
 * @param {import('./run.js').ExperimentConfig} config
 * @param {ReturnType<typeof provenance>} origin
 * @returns {string[]}
 */
export function warningsFor(config, origin) {
  const warnings = [];
  if (config.seeds.length < 20) {
    warnings.push(
      `${config.seeds.length} seeds: enough for a check, but a reported result needs at least 20 (ADR-009)`,
    );
  }
  for (const target of config.targets) {
    const needed = Math.ceil(10 / target - 1e-9);
    if (target > 0 && config.calibrationSize < needed) {
      warnings.push(
        `target ${target}: the threshold is noisy with ${config.calibrationSize} calibration requests; use at least 10/α = ${needed} (methods.md §6)`,
      );
    }
  }
  if (origin.dirty) {
    warnings.push('uncommitted changes: the recorded commit does not fully describe the code');
  }
  if (origin.dirty === null) warnings.push('git is not available: no commit is recorded');
  return warnings;
}

/**
 * Run the experiment and write its files.
 * @param {string[]} argv
 * @param {{ log?: (line: string) => void, warn?: (line: string) => void, now?: Date }} [io]
 * @returns {number} the exit code
 */
export function runCli(argv, { log = console.log, warn = console.error, now = new Date() } = {}) {
  let parsed;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    warn(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.help) {
    log(USAGE);
    return 0;
  }
  const { config } = parsed;
  const origin = provenance(ROOT, now);
  for (const warning of warningsFor(config, origin)) warn(`warning: ${warning}`);

  const result = runExperiment(config, {
    onSeed: (done, total, seed) => warn(`seed ${seed}: done (${done}/${total})`),
  });
  const results = { provenance: origin, ...result };
  const dir = path.resolve(parsed.out ?? path.join(ROOT, 'results', runName(origin)));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(path.join(dir, 'report.md'), formatReport(results));

  const { modes } = result.summary;
  const percent = (x) => `${(x * 100).toFixed(2)}%`;
  const shown = dir.startsWith(process.cwd() + path.sep) ? path.relative(process.cwd(), dir) : dir;
  log(`Wrote ${path.join(shown, 'results.json')} and report.md`);
  log(`AUC: ${MODES.map((m) => `${m} ${modes[m].auc.estimate.toFixed(3)}`).join(' · ')}`);
  config.targets.forEach((target, i) => {
    const line = (key) => MODES.map((m) => `${m} ${percent(modes[m].points[i][key].estimate)}`);
    log(`Target FPR ${percent(target)}: test FPR ${line('fpr').join(' · ')}`);
    log(
      `${' '.repeat(`Target FPR ${percent(target)}: `.length)}TPR      ${line('tpr').join(' · ')}`,
    );
  });
  return 0;
}

/** "2026-11-13T10-22-31-e2ac7c7", with "-dirty" when the tree had uncommitted changes. */
function runName({ createdAt, commit, dirty }) {
  return `${createdAt.slice(0, 19).replaceAll(':', '-')}-${commit.slice(0, 7)}${dirty ? '-dirty' : ''}`;
}

const invokedDirectly =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = runCli(process.argv.slice(2));
