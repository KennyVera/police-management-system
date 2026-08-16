import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { RANKING_ZONAS } from "../data/demoPanorama";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function RankingZonasChart({ isDark }) {
  const tick = isDark ? "#9ca3af" : "#6b7280";

  const data = {
    labels: RANKING_ZONAS.labels,
    datasets: [
      {
        label: "Índice",
        data: RANKING_ZONAS.values,
        backgroundColor: "#7c5cbf",
        borderRadius: 6,
        barThickness: 14,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const d = RANKING_ZONAS.deltas[ctx.dataIndex];
            if (d == null) return "";
            return `Variación: ${d > 0 ? "+" : ""}${d}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: tick, font: { size: 10 } },
        border: { display: false },
      },
      y: {
        grid: { display: false, drawBorder: false },
        ticks: { color: isDark ? "#e5e7eb" : "#374151", font: { size: 11, weight: "600" } },
        border: { display: false },
      },
    },
  };

  return (
    <div className="ve-chart-box ve-ranking-chart">
      <Bar data={data} options={options} />
    </div>
  );
}
