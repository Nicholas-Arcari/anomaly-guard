// What every page shares (ADR-010): read the experiment settings from the URL, keep them in every
// internal link, fill the settings form, mark the current page and open the sidebar on narrow
// screens. Works inside a sandboxed iframe: no storage, no access to the embedding page.

import { parseState, toQuery, withState } from './state.js';

/**
 * Wire up the shared header, settings bar and sidebar.
 * @returns {import('./state.js').ExperimentState} the settings of this page
 */
export function initShell() {
  const state = parseState(location.search);
  const page = document.body.dataset.page;

  for (const link of document.querySelectorAll('a[data-nav], a[data-keep-state]')) {
    link.setAttribute('href', withState(link.getAttribute('href') ?? './index.html', state));
    if (link instanceof HTMLElement && link.dataset.nav === page) {
      link.setAttribute('aria-current', 'page');
    }
  }

  const form = document.querySelector('form[data-experiment-form]');
  if (form instanceof HTMLFormElement) {
    for (const [key, value] of Object.entries(state)) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        field.value = String(value);
      }
    }
    form.addEventListener('submit', (event) => {
      // Navigate from script: a sandboxed iframe without `allow-forms` blocks form submission,
      // but a page may always navigate itself. Page parameters (filter, page number) reset.
      event.preventDefault();
      const next = parseState(new URLSearchParams(/** @type {any} */ (new FormData(form))));
      location.search = toQuery(next);
    });
  }

  const toggle = document.querySelector('[data-nav-toggle]');
  toggle?.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  for (const target of document.querySelectorAll('[data-experiment]')) {
    target.textContent = describe(state);
  }
  return state;
}

/**
 * One line that says which experiment the page shows.
 * @param {import('./state.js').ExperimentState} state
 */
export function describe(state) {
  const p = `p ≤ ${pOf(state.threshold)}`;
  const when = {
    combined: `alert on a rule match or when ${p}`,
    stats: `statistics only, alert when ${p}`,
    rules: 'rules only, alert on a rule match',
  }[state.mode];
  const share = Number((state.prevalence * 100).toFixed(1));
  return (
    `Simulated traffic · seed ${state.seed} · ${state.size.toLocaleString('en-US')} test ` +
    `requests, ${share}% attacks · ${when}`
  );
}

/**
 * The tail probability a threshold stands for, p = 10^−threshold, written plainly.
 * @param {number} threshold
 * @returns {string} e.g. '0.1', '0.01', '0.032', '1·10^−6'
 */
export function pOf(threshold) {
  const p = 10 ** -threshold;
  return p >= 1e-4 ? String(Number(p.toPrecision(2))) : p.toExponential(0).replace('e-', '·10^−');
}
