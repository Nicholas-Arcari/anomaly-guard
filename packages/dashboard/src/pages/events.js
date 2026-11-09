// Security events: every analysed request with its verdict, alert level and reason, and the
// simulator's ground truth to check it against. Filters and page numbers are plain links
// (?show=…&page=…), like the rest of the multi-page app (ADR-010). Payloads are shown as text only.

import { initShell } from '../shell.js';
import { runExperiment, topPart } from '../pipeline.js';
import { severityOf } from '../levels.js';
import { withState } from '../state.js';
import { h, mount, fmt } from '../dom.js';
import { levelBadge } from '../ui.js';

const PAGE_SIZE = 25;
const COLUMNS = 8;

/** @type {Record<string, { label: string, keep: (e: import('../pipeline.js').DashboardEvent) => boolean }>} */
const FILTERS = {
  all: { label: 'All', keep: () => true },
  alerts: { label: 'Alerts', keep: (e) => e.alert },
  clean: { label: 'Not flagged', keep: (e) => !e.alert },
  mistakes: { label: 'Detector mistakes', keep: (e) => !e.correct },
};

const state = initShell();
const { events } = runExperiment(state);
const query = new URLSearchParams(location.search);
const requested = query.get('show') ?? 'all';
const show = Object.hasOwn(FILTERS, requested) ? requested : 'all';
const rows = events.filter(FILTERS[show].keep);
const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
const page = clampPage(query.get('page'), pages);
const first = (page - 1) * PAGE_SIZE;
const shown = rows.slice(first, first + PAGE_SIZE);

mount(
  '#tabs',
  Object.entries(FILTERS).map(([key, filter]) =>
    h(
      'a',
      {
        href: link({ show: key === 'all' ? null : key, page: null }),
        'aria-current': key === show ? 'page' : null,
      },
      filter.label,
      h('span', { class: 'count' }, fmt.int(events.filter(filter.keep).length)),
    ),
  ),
);

mount(
  '#events-meta',
  rows.length
    ? `${fmt.int(first + 1)}–${fmt.int(first + shown.length)} of ${fmt.int(rows.length)}`
    : 'No events',
);

if (shown.length) mount('#events-body', shown.map(eventRows));
else {
  mount(
    '#events-body',
    h('tr', {}, h('td', { colspan: COLUMNS, class: 'empty' }, 'No events match this filter.')),
  );
}

mount(
  '#pager',
  h('span', {}, `Page ${page} of ${pages}`),
  h(
    'span',
    { class: 'pager-links' },
    page > 1
      ? h('a', { href: link({ page: page - 1 > 1 ? page - 1 : null }) }, '← Previous')
      : h('span', { class: 'is-disabled' }, '← Previous'),
    page < pages
      ? h('a', { href: link({ page: page + 1 }) }, 'Next →')
      : h('span', { class: 'is-disabled' }, 'Next →'),
  ),
);

/** A link to this page with the current settings and filter. @param {Record<string, any>} extra */
function link(extra) {
  return withState('./events.html', state, { show: show === 'all' ? null : show, ...extra });
}

/** @param {string | null} raw @param {number} pages */
function clampPage(raw, pages) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= pages ? n : 1;
}

/** The summary row and its (hidden) detail row. @param {import('../pipeline.js').DashboardEvent} e */
function eventRows(e) {
  const { request } = e.sample;
  const detailId = `event-${e.id}`;
  const params = Object.entries(request.params)
    .map(([name, value]) => `${name}=${value}`)
    .join('  ');

  const toggle = h(
    'button',
    {
      class: 'row-toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': detailId,
      'aria-label': `Details of event ${e.id}`,
    },
    h('span', { class: 'chevron', 'aria-hidden': 'true' }),
  );
  const row = h(
    'tr',
    { class: e.correct ? 'event-row' : 'event-row is-mistake' },
    h('td', {}, toggle),
    h('td', { class: 'num' }, String(e.id)),
    h('td', { class: 'mono nowrap' }, `${request.method} ${request.path}`),
    h('td', { class: 'mono truncate', title: params }, params),
    h('td', {}, levelBadge(e.level)),
    h('td', { class: 'nowrap' }, detection(e)),
    h(
      'td',
      {},
      e.alert
        ? h('span', { class: 'badge is-alert' }, 'Alert')
        : h('span', { class: 'badge is-clean' }, 'Not flagged'),
    ),
    h('td', {}, truth(e)),
  );
  const detail = h(
    'tr',
    { class: 'event-detail', id: detailId, hidden: true },
    h('td', { colspan: COLUMNS }, detailView(e)),
  );

  const flip = () => {
    const open = detail.hidden;
    detail.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    row.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    flip();
  });
  row.addEventListener('click', flip);
  return [row, detail];
}

/** Which rule or signal raised the alert. @param {import('../pipeline.js').DashboardEvent} e */
function detection(e) {
  const { result } = e;
  if (result.ruleMatched) {
    return h(
      'span',
      { class: 'mono' },
      [...new Set(result.detail.hits.map((x) => x.ruleId))].join(', '),
    );
  }
  if (e.alert) {
    const top = topPart(result.detail.parts);
    return top ? `${top.name} · s = ${fmt.score(top.score)}` : 'statistics';
  }
  return h('span', { class: 'muted' }, '—');
}

/** The simulator's label, and whether the detector got it wrong. @param {import('../pipeline.js').DashboardEvent} e */
function truth(e) {
  const { sample } = e;
  const text =
    sample.label === 'attack'
      ? `attack · ${sample.kind} · ${sample.variant}`
      : `legit · ${sample.variant}`;
  if (e.correct) return text;
  return [text, ' ', h('span', { class: 'badge is-mistake' }, e.alert ? 'false alarm' : 'missed')];
}

/** @param {import('../pipeline.js').DashboardEvent} e */
function detailView(e) {
  const { sample, result } = e;
  /** @type {[string, string, string?][]} */
  const facts = [
    ['Request', `${sample.request.method} ${sample.request.path}`, 'mono'],
    ...Object.entries(sample.request.params).map(([name, value]) => [
      `Parameter ${name}`,
      String(value),
      'mono',
    ]),
    ['Detector score', fmt.score(result.score)],
    ['Statistical score', `${fmt.score(result.statScore)} (−log₁₀ p)`],
    ...Object.entries(result.detail.parts).map(([name, score]) => [
      `Signal ${name}`,
      fmt.score(score),
    ]),
    ['Alert level', `${e.level} · ${severityOf(e.level)} severity`],
    ['Why', result.reasons.length ? result.reasons.join('; ') : 'nothing reached the threshold'],
    [
      'Ground truth',
      sample.label === 'attack'
        ? `attack (${sample.kind}, ${sample.variant})`
        : `legitimate (${sample.variant})`,
    ],
  ];
  const json = JSON.stringify(
    {
      request: sample.request,
      verdict: result.verdict,
      score: result.score,
      statScore: result.statScore,
      ruleMatched: result.ruleMatched,
      hits: result.detail.hits,
      parts: result.detail.parts,
      reasons: result.reasons,
      level: e.level,
      truth: { label: sample.label, kind: sample.kind, variant: sample.variant },
    },
    (_key, value) => (value === Infinity ? 'Infinity' : value),
    2,
  );
  return h(
    'div',
    { class: 'detail-grid' },
    h(
      'div',
      {},
      h('h3', { class: 'detail-title' }, 'Summary'),
      h(
        'dl',
        { class: 'kv' },
        facts.map(([term, value, cls]) => [h('dt', {}, term), h('dd', { class: cls }, value)]),
      ),
    ),
    h('div', {}, h('h3', { class: 'detail-title' }, 'JSON'), h('pre', { class: 'json' }, json)),
  );
}
