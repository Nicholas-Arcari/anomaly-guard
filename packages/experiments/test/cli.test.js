import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseCliArgs, runCli, warningsFor, USAGE } from '../src/cli.js';
import { DEFAULT_CONFIG, MODES } from '../src/run.js';

const CLEAN = { createdAt: '2026-11-13T10:00:00.000Z', commit: 'abc', dirty: false, node: 'v22' };

test('parseCliArgs: the defaults are the ADR-009 configuration', () => {
  const { help, config, out } = parseCliArgs([]);
  assert.equal(help, false);
  assert.equal(out, undefined);
  assert.deepEqual(config, {
    ...DEFAULT_CONFIG,
    seeds: [...DEFAULT_CONFIG.seeds],
    targets: [0.01, 0.001],
  });
});

test('parseCliArgs: options', () => {
  const { config, out } = parseCliArgs([
    '--seeds',
    '4',
    '--first-seed',
    '100',
    '--targets',
    '0.05,0.01',
    '--test',
    '800',
    '--hard-share',
    '0',
    '--out',
    'somewhere',
  ]);
  assert.deepEqual(config.seeds, [100, 101, 102, 103]);
  assert.deepEqual(config.targets, [0.05, 0.01]);
  assert.equal(config.testSize, 800);
  assert.equal(config.hardShare, 0);
  assert.equal(out, 'somewhere');
  assert.deepEqual(parseCliArgs(['--help']), { help: true });
});

test('parseCliArgs: rejects unknown options and bad values', () => {
  for (const argv of [['--bogus'], ['positional']]) {
    assert.throws(() => parseCliArgs(argv), TypeError, argv.join(' '));
  }
  for (const argv of [
    ['--seeds', '1'],
    ['--seeds', 'many'],
    ['--train', ''],
    ['--targets', '0.01,abc'],
    ['--prevalence', '2'],
  ]) {
    assert.throws(() => parseCliArgs(argv), RangeError, argv.join(' '));
  }
});

test('warningsFor: too few seeds, a noisy threshold, uncommitted changes', () => {
  assert.deepEqual(warningsFor(parseCliArgs([]).config, CLEAN), []);
  const quick = parseCliArgs(['--seeds', '3', '--calibration', '2000']).config;
  const warnings = warningsFor(quick, { ...CLEAN, dirty: true });
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /at least 20/);
  assert.match(warnings[1], /10\/α = 10000/);
  assert.match(warnings[2], /uncommitted/);
  assert.match(warningsFor(parseCliArgs([]).config, { ...CLEAN, dirty: null })[0], /git/);
});

test('runCli: writes results.json and report.md with the provenance', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'anomaly-guard-experiments-'));
  try {
    const logs = [];
    const warnings = [];
    const now = new Date('2026-11-13T09:30:00Z');
    const code = runCli(
      [
        ...['--seeds', '2', '--train', '200', '--calibration', '500', '--test', '300'],
        ...['--resamples', '20', '--targets', '0.02', '--out', dir],
      ],
      { log: (line) => logs.push(line), warn: (line) => warnings.push(line), now },
    );
    assert.equal(code, 0);
    const results = JSON.parse(readFileSync(path.join(dir, 'results.json'), 'utf8'));
    assert.equal(results.provenance.createdAt, now.toISOString());
    assert.match(results.provenance.commit, /^([0-9a-f]{40}|unknown)$/);
    assert.equal(results.provenance.node, process.version);
    assert.deepEqual(results.config.seeds, [1, 2]);
    assert.equal(results.seeds.length, 2);
    assert.deepEqual(Object.keys(results.summary.modes), MODES);
    const report = readFileSync(path.join(dir, 'report.md'), 'utf8');
    assert.match(report, /^# Experiment results \(D-04\)/);
    assert.match(report, /## 2\. Target FPR 2\.0%/);
    assert.match(report, /\| Seeds \| 2: 1–2 \|/);
    assert.ok(logs[0].includes('results.json'));
    assert.ok(warnings.some((line) => line.includes('at least 20')));
    assert.ok(warnings.some((line) => line.startsWith('seed 2: done (2/2)')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCli: usage on --help, exit code 2 on a bad option', () => {
  const logs = [];
  assert.equal(runCli(['--help'], { log: (line) => logs.push(line) }), 0);
  assert.equal(logs[0], USAGE);
  const warnings = [];
  assert.equal(runCli(['--seeds', '0'], { warn: (line) => warnings.push(line) }), 2);
  assert.match(warnings[0], /--seeds/);
  assert.ok(warnings[0].includes(USAGE));
});
