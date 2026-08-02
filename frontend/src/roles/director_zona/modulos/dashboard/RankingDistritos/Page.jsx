import "./RankingDistritos.css";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";

function Sparkline({ values = [] }) {
  const w = 88;
  const h = 28;
  const data = values.length ? values : [0];
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const up = (data[data.length - 1] || 0) >= (data[0] || 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dz-spark" aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={up ? "#ef4444" : "#22c55e"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScatterPlot({ ranking }) {
  const w = 520;
  const h = 280;
  const pad = { t: 20, r: 20, b: 40, l: 48 };
  const rows = ranking || [];
  const maxX = Math.max(1, ...rows.map((r) => r.delitos || 0));
  const maxY = Math.max(1, ...rows.map((r) => r.arrestos || 0));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const color = {
    rojo: "#ef4444",
    verde: "#22c55e",
    amarillo: "#f59e0b",
    neutro: "#7c5cbf",
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dz-scatter-svg" role="img" aria-label="Matriz de eficiencia">
      <line x1={pad.l} y1={pad.t + innerH} x2={w - pad.r} y2={pad.t + innerH} stroke="#e5e7eb" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="#e5e7eb" />
      {/* medianas */}
      <line
        x1={pad.l + innerW / 2}
        x2={pad.l + innerW / 2}
        y1={pad.t}
        y2={pad.t + innerH}
        stroke="#e8ecf3"
        strokeDasharray="4 4"
      />
      <line
        x1={pad.l}
        x2={w - pad.r}
        y1={pad.t + innerH / 2}
        y2={pad.t + innerH / 2}
        stroke="#e8ecf3"
        strokeDasharray="4 4"
      />
      <text x={w / 2} y={h - 8} textAnchor="middle" className="dz-axis">
        Delitos reportados →
      </text>
      <text
        x={14}
        y={h / 2}
        textAnchor="middle"
        className="dz-axis"
        transform={`rotate(-90 14 ${h / 2})`}
      >
        Arrestos (efectividad) →
      </text>
      {rows.map((r) => {
        const x = pad.l + ((r.delitos || 0) / maxX) * innerW;
        const y = pad.t + innerH - ((r.arrestos || 0) / maxY) * innerH;
        return (
          <g key={r.distrito}>
            <circle
              cx={x}
              cy={y}
              r="8"
              fill={color[r.cuadrante] || color.neutro}
              fillOpacity="0.85"
            />
            <text x={x + 10} y={y + 4} className="dz-scatter-label">
              {r.distrito}
            </text>
          </g>
        );
      })}
      {!rows.length && (
        <text x={w / 2} y={h / 2} textAnchor="middle" className="dz-axis">
          Sin distritos para graficar
        </text>
      )}
    </svg>
  );
}

export default function RankingDistritos({ ranking, loading }) {
  if (loading && !ranking?.length) {
    return <p className="mod-muted">Cargando ranking…</p>;
  }

  return (
    <div className="dz-ranking">
      <article className="dz-card">
        <div className="dz-card-head">
          <h3>Matriz de Eficiencia (Delitos × Arrestos)</h3>
          <div className="dz-cuad-legend">
            <span><i className="c rojo" /> Muchos delitos / pocos arrestos</span>
            <span><i className="c verde" /> Alta efectividad</span>
            <span><i className="c amarillo" /> Equilibrado</span>
          </div>
        </div>
        <ScatterPlot ranking={ranking} />
      </article>

      <article className="dz-card">
        <div className="dz-card-head">
          <h3>Leaderboard · Top distritos</h3>
          <span className="dz-chip">Sparklines 7 días</span>
        </div>
        <div className="dz-board">
          {(ranking || []).map((r, idx) => (
            <div key={r.distrito} className={`dz-board-row tone-${r.cuadrante || "neutro"}`}>
              <span className="dz-pos">#{idx + 1}</span>
              <div className="dz-board-main">
                <strong>{r.distrito}</strong>
                <small>
                  {r.delitos} delitos · {r.arrestos} arrestos
                </small>
              </div>
              <Sparkline values={r.sparkline || []} />
              <span className="dz-trend-mini" title="Tendencia 7 días">
                <MaterialIcon
                  name={(r.tendencia || 0) > 0 ? "trending_up" : "trending_down"}
                />
              </span>
            </div>
          ))}
          {!ranking?.length && (
            <p className="dz-empty-inline">Sin ranking disponible para el filtro.</p>
          )}
        </div>
      </article>
    </div>
  );
}
