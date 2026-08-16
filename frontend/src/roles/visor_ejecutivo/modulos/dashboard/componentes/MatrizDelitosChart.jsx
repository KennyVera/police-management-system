import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { MATRIZ_DELITOS } from "../data/demoPanorama";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function MatrizDelitosChart({ isDark }) {
  const data = {
    labels: MATRIZ_DELITOS.labels,
    datasets: [
      {
        data: MATRIZ_DELITOS.values,
        backgroundColor: MATRIZ_DELITOS.colors,
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
        },
      },
    },
  };

  return (
    <div className="ve-donut-layout">
      <div className="ve-donut-wrap">
        <Doughnut data={data} options={options} />
        <div className="ve-donut-center">
          <strong>{MATRIZ_DELITOS.total.toLocaleString("es-EC")}</strong>
          <span>Total Delitos</span>
        </div>
      </div>
      <ul className="ve-donut-legend">
        {MATRIZ_DELITOS.labels.map((label, i) => (
          <li key={label}>
            <i style={{ background: MATRIZ_DELITOS.colors[i] }} />
            <span className={isDark ? "dark-label" : undefined}>{label}</span>
            <em>{MATRIZ_DELITOS.values[i]}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
