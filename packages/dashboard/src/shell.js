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
    // The threshold field only counts with a manual threshold: otherwise the threshold is
    // calibrated (E-06), so the field is read-only (still sent, so a manual value is kept).
    const fpr = form.elements.namedItem('fpr');
    const threshold = form.elements.namedItem('threshold');
    if (fpr instanceof HTMLSelectElement && threshold instanceof HTMLInputElement) {
      const sync = () => {
        threshold.readOnly = fpr.value !== 'manual';
      };
      fpr.addEventListener('change', sync);
      sync();
    }
    // Apply from the button's click, not from the form's `submit` event: in a sandboxed iframe
    // without `allow-forms` the browser cancels the submission before `submit` is even fired,
    // while a click still fires and a page may always navigate itself. Enter in a field also
    // lands here (implicit submission clicks the default button). Page parameters (filter, page
    // number) reset with a new experiment.
    /** @param {Event} event */
    const apply = (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return; // the sandbox also skips the browser's own checks
      const next = parseState(new URLSearchParams(/** @type {any} */ (new FormData(form))));
      location.search = toQuery(next);
    };
    form.querySelector('button[type="submit"]')?.addEventListener('click', apply);
    form.addEventListener('submit', apply); // e.g. requestSubmit() outside a sandbox
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
  const cut =
    state.fpr === 'manual'
      ? `when p ≤ ${pOf(state.threshold)}`
      : `above the threshold for ${percent(state.fpr)} false positives`;
  const when = {
    combined: `alert on a rule match or ${cut}`,
    stats: `statistics only, alert ${cut}`,
    rules: 'rules only, alert on a rule match',
  }[state.mode];
  const share = Number((state.prevalence * 100).toFixed(1));
  return (
    `Simulated traffic · seed ${state.seed} · ${state.size.toLocaleString('en-US')} test ` +
    `requests, ${share}% attacks · ${when}`
  );
}

/**
 * A rate as a short percentage: 0.01 → '1%', 0.005 → '0.5%'.
 * @param {number} rate
 */
export function percent(rate) {
  return `${Number((rate * 100).toFixed(2))}%`;
}

/**
 * The tail probability a threshold stands for, p = 10^−threshold, written plainly.
 * @param {number} threshold
 * @returns {string} e.g. '0.1', '0.01', '0.032', '1·10^−6'
 */
export function pOf(threshold) {
  const p = 10 ** -threshold;
  return threshold <= 4
    ? String(Number(p.toPrecision(2)))
    : p.toExponential(0).replace('e-', '·10^−');
}
