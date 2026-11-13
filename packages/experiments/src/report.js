// The human-readable side of a run: results/<run>/report.md, with the provenance on top and the
// tables the written report quotes. Pure: a string built from the results object.

import { MODES } from './run.js';

const VARIANTS = { attack: ['canonical', 'obfuscated', 'novel'], legit: ['typical', 'hard'] };
const LABEL = { attack: 'Attack', legit: 'Legitimate' };

/**
 * @param {{ provenance: { createdAt: string, commit: string, dirty: boolean | null, node: string },
 *   config: import('./run.js').ExperimentConfig, summary: { modes: Record<string, any> } }} results
 * @returns {string} Markdown
 */
export function formatReport({ provenance, config, summary }) {
  const { modes } = summary;
  const seedCount = config.seeds.length;
  const first = modes[MODES[0]].points[0];
  const perSeed = (count) => count / seedCount;
  const attacks = perSeed(first.pooled.tp + first.pooled.fn);
  const legit = perSeed(first.pooled.fp + first.pooled.tn);
  const hard = perSeed(first.byVariant.legit.hard?.requests ?? 0);

  const out = [
    '# Experiment results (D-04)',
    '',
    '| Run | |',
    '| --- | --- |',
    `| Date | ${provenance.createdAt} |`,
    `| Code | ${codeLine(provenance)} |`,
    `| Node | ${provenance.node} |`,
    `| Seeds | ${seedCount}: ${seedList(config.seeds)} |`,
    `| Per seed | train ${int(config.trainSize)} · calibration ${int(config.calibrationSize)} · ` +
      `test ${int(config.testSize)} = ${int(attacks)} attacks + ${int(legit)} legitimate ` +
      `(${int(hard)} of them hard cases) |`,
    `| Target FPR | ${config.targets.map((t) => pct(t, { digits: 1 })).join(', ')} |`,
    `| AUC bootstrap | ${int(config.resamples)} stratified resamples per seed and mode, seed + 2³¹ |`,
    '',
    '## How to read it',
    '',
    '- Every seed is a separate run, with its own training data, model, thresholds and test ' +
      'set (ADR-009). The model is fitted on legitimate requests only, and each threshold is set ' +
      'on legitimate calibration requests only. Attack labels are used only to score the test set.',
    '- **mean [a–b]**: the mean over the seeds and, in brackets, the 95% Student-t interval of ' +
      'that mean (methods.md §6). "every seed": the value was the same in every seed, so the ' +
      'interval has no width; group rows then add the count over all seeds.',
    '- `results.json` holds every seed on its own, with its Wilson intervals (rates) and ' +
      'bootstrap interval (AUC).',
    '',
    '## 1. AUC (no threshold)',
    '',
    '| Mode | AUC | SD across seeds | Range | Mean width of one seed’s 95% bootstrap interval |',
    '| --- | --- | --- | --- | --- |',
    ...MODES.map((mode) => {
      const { auc, aucBootstrapWidth } = modes[mode];
      return `| ${mode} | ${across(auc, dec3)} | ${dec3(auc.sd)} | ${spread(auc, dec3)} | ${dec3(aucBootstrapWidth)} |`;
    }),
    '',
  ];

  config.targets.forEach((target, i) => {
    const at = (mode) => modes[mode].points[i];
    out.push(
      `## ${i + 2}. Target FPR ${pct(target, { digits: 1 })}`,
      '',
      'Each seed sets its threshold on its own legitimate calibration split, then scores its test ' +
        'split once.',
      '',
      '| Mode | Threshold | Calibration FPR | Test FPR, typical legitimate | Test FPR, all legitimate | TPR (recall) | FNR | Precision | F1 | Target met on calibration |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...MODES.map((mode) => {
        const p = at(mode);
        const threshold = p.calibrated ? across(p.threshold, dec3) : '— (a rule match)';
        const typical = p.byVariant.legit.typical?.rate;
        return (
          `| ${mode} | ${threshold} | ${across(p.calibrationFpr, pct)} | ${across(typical, pct)} | ` +
          `${across(p.fpr, pct)} | ${across(p.tpr, pct)} | ${across(p.fnr, pct)} | ` +
          `${across(p.precision, pct)} | ${across(p.f1, dec3)} | ${p.attainableSeeds}/${seedCount} seeds |`
        );
      }),
      '',
      'Spread across seeds (SD; min–max):',
      '',
      '| Mode | Test FPR | TPR (recall) |',
      '| --- | --- | --- |',
      ...MODES.map((mode) => {
        const p = at(mode);
        return `| ${mode} | ${pct(p.fpr.sd)}; ${spread(p.fpr, pct)} | ${pct(p.tpr.sd)}; ${spread(p.tpr, pct)} |`;
      }),
      '',
      `Confusion matrix, added up over the ${seedCount} seeds:`,
      '',
      '| Mode | TP | FN | FP | TN |',
      '| --- | --- | --- | --- | --- |',
      ...MODES.map((mode) => {
        const { tp, fn, fp, tn } = at(mode).pooled;
        return `| ${mode} | ${int(tp)} | ${int(fn)} | ${int(fp)} | ${int(tn)} |`;
      }),
      '',
      '### By variant',
      '',
      ...groupTable(modes, i, 'byVariant', (label, names) =>
        VARIANTS[label].filter((v) => names.includes(v)),
      ),
      '',
      '### By attack family and legitimate endpoint',
      '',
      ...groupTable(modes, i, 'byKind', (_label, names) => names),
      '',
    );
  });

  out.push(
    '## Notes',
    '',
    '- Rules mode has no threshold: its score is 1 on a rule match and 0 otherwise. So its row is ' +
      'the same at every target, and "Target met on calibration" says whether the rules alone stay ' +
      'within the target on legitimate traffic.',
    '- In combined mode a rule match scores +∞ (ADR-007) and is flagged at any threshold. If the ' +
      'rules alone flag more legitimate calibration requests than the target allows, the target ' +
      'cannot be met. The threshold then sits above every finite calibration score, so only the ' +
      'rules fire (`thresholdAtFpr`, methods.md §6).',
    '- The calibration split has no hard cases. So the test FPR of the typical legitimate ' +
      'requests is the out-of-sample check of the target. The hard cases (O’Brien, long free ' +
      'text, non-Latin text) are a stress test, and they are why the FPR over all legitimate ' +
      'requests can be higher.',
    '- For attacks the group rate is the detection rate; for legitimate requests it is the ' +
      'false-positive rate.',
  );
  return `${out.join('\n')}\n`;
}

/**
 * One row per group: its share flagged in each mode (detection rate for attacks, false-positive
 * rate for legitimate requests).
 */
function groupTable(modes, pointIndex, field, order) {
  const groups = (mode) => modes[mode].points[pointIndex][field];
  const rows = [
    '| Group | Requests per seed | ' + MODES.join(' | ') + ' |',
    '| --- | --- | ' + MODES.map(() => '---').join(' | ') + ' |',
  ];
  for (const label of /** @type {const} */ (['attack', 'legit'])) {
    const reference = groups(MODES[0])[label]; // the same test requests in every mode
    for (const name of order(label, Object.keys(reference))) {
      const cells = MODES.map((mode) => groupCell(groups(mode)[label][name]));
      const { min, max } = reference[name].requestsPerSeed;
      const sizes = min === max ? int(min) : `${int(min)}–${int(max)}`;
      rows.push(`| ${LABEL[label]} · ${name} | ${sizes} | ${cells.join(' | ')} |`);
    }
  }
  return rows;
}

/**
 * A group's rate across seeds. With the same rate in every seed the cell gives the count it rests
 * on; with the group in a single seed, only that count.
 */
function groupCell(group) {
  const count = `${int(group.flagged)}/${int(group.requests)}`;
  if (!group.rate) return `${count} (${group.seeds} seed)`;
  if (group.rate.min === group.rate.max)
    return `${pct(group.rate.estimate)} (every seed: ${count})`;
  return across(group.rate, pct);
}

/** "mean [lower–upper]" or "value (every seed)"; "—" when undefined. */
function across(interval, format) {
  if (!interval) return '—';
  if (interval.min === interval.max) return `${format(interval.estimate)} (every seed)`;
  const bare = { unit: false };
  return `${format(interval.estimate)} [${format(interval.lower, bare)}–${format(interval.upper, bare)}]`;
}

function spread(interval, format) {
  return `${format(interval.min, { unit: false })}–${format(interval.max)}`;
}

function codeLine({ commit, dirty }) {
  if (dirty === null) return `commit ${commit} (git not available)`;
  return dirty
    ? `commit \`${commit}\` **with uncommitted changes**: the commit does not fully describe the code`
    : `commit \`${commit}\` (no uncommitted changes)`;
}

/** "1–20" for consecutive seeds, otherwise the list. */
function seedList(seeds) {
  const consecutive = seeds.every((s, i) => i === 0 || s === seeds[i - 1] + 1);
  return consecutive ? `${seeds[0]}–${seeds[seeds.length - 1]}` : seeds.join(', ');
}

/** Percentage; `unit: false` drops the % sign (inside brackets, after the estimate). */
function pct(value, { digits = 2, unit = true } = {}) {
  return `${(value * 100).toFixed(digits)}${unit ? '%' : ''}`;
}

function dec3(value) {
  return value.toFixed(3);
}

function int(value) {
  return value.toLocaleString('en-US');
}
