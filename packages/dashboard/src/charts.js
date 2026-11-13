// Chart.js, registered once with only the pieces the dashboard uses (a smaller bundle) and themed
// from the CSS tokens, so light and dark mode both work. Theme panels (E-02, E-03, E-06) reuse it:
// register any extra Chart.js component they need in the list below.

import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

/**
 * The value of a CSS custom property, e.g. token('--primary').
 * @param {string} name
 */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Apply the dashboard theme to Chart.js. Call once per page, before creating charts. */
export function setupCharts() {
  Chart.defaults.font.family = token('--font');
  Chart.defaults.font.size = 12;
  Chart.defaults.color = token('--text-muted');
  Chart.defaults.borderColor = token('--border');
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation = false;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
}

/**
 * A bar chart with one series.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], values: number[], colors: string | string[], label: string,
 *   horizontal?: boolean }} data
 */
export function barChart(canvas, { labels, values, colors, label, horizontal = false }) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label, data: values, backgroundColor: colors, borderRadius: 2, maxBarThickness: 32 },
      ],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: horizontal },
          ticks: { precision: 0, maxRotation: 0 },
          beginAtZero: true,
        },
        y: { grid: { display: !horizontal }, ticks: { precision: 0 }, beginAtZero: true },
      },
    },
  });
}

/**
 * A doughnut chart.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], values: number[], colors: string[] }} data
 */
export function doughnutChart(canvas, { labels, values, colors }) {
  return new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: { cutout: '62%', plugins: { legend: { position: 'right' } } },
  });
}

/**
 * ROC curves (E-02, theme T3): true-positive rate against false-positive rate, one line per curve,
 * the chance diagonal, and marked points such as the current operating point.
 * @param {HTMLCanvasElement} canvas
 * @param {{ curves: { label: string, color: string, points: { fpr: number, tpr: number }[] }[],
 *   marks?: { label: string, color: string, fpr: number, tpr: number }[] }} data
 */
export function rocChart(canvas, { curves, marks = [] }) {
  const percent = (value) => `${Math.round(Number(value) * 100)}%`;
  const axis = (text) => ({
    type: /** @type {const} */ ('linear'),
    min: 0,
    max: 1,
    title: { display: true, text },
    ticks: { callback: percent, stepSize: 0.2 },
  });
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        ...curves.map(({ label, color, points }) => ({
          label,
          data: points.map((p) => ({ x: p.fpr, y: p.tpr })),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 0,
        })),
        {
          label: 'Chance (AUC 0.5)',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          borderColor: token('--border-strong'),
          backgroundColor: token('--border-strong'),
          borderDash: [4, 4],
          borderWidth: 1,
          pointRadius: 0,
        },
        ...marks.map(({ label, color, fpr, tpr }) => ({
          label,
          data: [{ x: fpr, y: tpr }],
          showLine: false,
          borderColor: color,
          backgroundColor: token('--panel-bg'),
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 7,
        })),
      ],
    },
    options: {
      scales: { x: axis('False-positive rate'), y: axis('True-positive rate (recall)') },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) =>
              `${item.dataset.label}: FPR ${(item.parsed.x * 100).toFixed(1)}%, ` +
              `TPR ${(item.parsed.y * 100).toFixed(1)}%`,
          },
        },
      },
    },
  });
}
