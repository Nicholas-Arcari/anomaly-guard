// Chart.js, registered once with only the pieces the dashboard uses (a smaller bundle) and themed
// from the CSS tokens, so light and dark mode both work. Theme panels (E-02, E-03, E-06) reuse it:
// register any extra Chart.js component they need (e.g. LineController and PointElement for the
// ROC curve) in the list below.

import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
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
