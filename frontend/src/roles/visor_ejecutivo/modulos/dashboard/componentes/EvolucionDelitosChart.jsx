import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { EVOLUCION } from "../data/demoPanorama";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function EvolucionDelitosChart({ isDark, anioActual = "2026", anioCompare = "2025" }) {
  const tick = isDark ? "#9ca3af" : "#6b7280";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.25)";

  const data = {
    labels: EVOLUCION.labels,
    datasets: [
      {
        label: anioCompare,
        data: EVOLUCION.y2025,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.18)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
      {
        label: anioActual,
        data: EVOLUCION.y2026,
        borderColor: "#7c5cbf",
        backgroundColor: "rgba(124, 92, 191, 0.22)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          color: isDark ? "#e5e7eb" : "#374151",
          usePointStyle: true,
          boxWidth: 8,
          font: { weight: "600", size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString("es-EC")}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tick, font: { size: 11 } },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 20000,
        grid: { color: grid, drawBorder: false },
        ticks: {
          color: tick,
          callback: (v) => (v >= 1000 ? `${v / 1000}K` : v),
          font: { size: 11 },
        },
        border: { display: false },
      },
    },
  };

  return (
    <div className="ve-chart-box ve-evolucion-chart">
      <Line data={data} options={options} />
    </div>
  );
}
