// Rules: the signature engine and how often each rule fired on the current test split, split by
// the simulator's ground truth. The ruleset itself is task B-01.

import { initShell } from '../shell.js';
import { runExperiment } from '../pipeline.js';
import { h, mount, fmt } from '../dom.js';
import { kpi } from '../ui.js';

const state = initShell();
const { events, ruleEngine } = runExperiment(state);
const evaluated = state.mode !== 'stats';

/** Requests matched per rule (a request counts once per rule), by ground truth. */
const matches = new Map(ruleEngine.rules.map((rule) => [rule.id, { all: 0, attack: 0, legit: 0 }]));
for (const e of events) {
  for (const id of new Set(e.result.detail.hits.map((hit) => hit.ruleId))) {
    const m = matches.get(id);
    if (!m) continue;
    m.all++;
    m[e.attack ? 'attack' : 'legit']++;
  }
}
const matched = events.filter((e) => e.result.ruleMatched);
const onLegit = matched.filter((e) => !e.attack).length;
const families = new Set(ruleEngine.rules.map((rule) => rule.kind));

mount(
  '#kpis',
  kpi('Rules', ruleEngine.rules.length),
  kpi(`Attack families covered (${[...families].join(', ')})`, families.size),
  kpi('Requests matched', evaluated ? matched.length : '—', 'primary'),
  kpi('Matches on legitimate requests', evaluated ? onLegit : '—', onLegit ? 'danger' : 'success'),
);

if (!evaluated) {
  mount(
    '#mode-note',
    h(
      'div',
      { class: 'callout is-warning' },
      'Statistics-only mode: the rules are not evaluated, so every count below is zero. ' +
        'Choose "Rules + statistics" or "Rules only" in the settings bar.',
    ),
  );
}

mount(
  '#rules-body',
  ruleEngine.rules.map((rule) => {
    const m = matches.get(rule.id) ?? { all: 0, attack: 0, legit: 0 };
    return h(
      'tr',
      {},
      h('td', { class: 'mono nowrap' }, rule.id),
      h('td', {}, rule.kind),
      h('td', { class: 'mono pattern' }, `/${rule.pattern.source}/${rule.pattern.flags}`),
      h('td', { class: 'num' }, fmt.int(m.all)),
      h('td', { class: 'num' }, fmt.int(m.attack)),
      h('td', { class: m.legit ? 'num is-bad' : 'num' }, fmt.int(m.legit)),
    );
  }),
);
