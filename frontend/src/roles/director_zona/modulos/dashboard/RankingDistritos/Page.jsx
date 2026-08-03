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

function shortDistrict(name = "") {
  const raw = String(name).trim();
  if (!raw) return "—";
  const first = raw.split(/\s*[—–-]\s*/)[0].trim();
  return first.length > 22 ? `${first.slice(0, 20)}…` : first;
}

function niceDomain(values, { floorZero = true } = {}) {
  const nums = values.length ? values : [0];
  let minV = Math.min(...nums);
  let maxV = Math.max(...nums);
  if (maxV === minV) {
    const pad = Math.max(Math.abs(maxV) * 0.35, 2);
    minV -= pad;
    maxV += pad;
  } else {
    const span = maxV - minV;
    const pad = Math.max(span * 0.35, 1);
    minV -= pad;
    maxV += pad;
  }
  if (floorZero) minV = Math.max(0, minV);
  if (maxV <= minV) maxV = minV + 1;
  return { minV, maxV };
}

function ScatterPlot({ ranking }) {
  const w = 560;
  const h = 320;
  const pad = { t: 28, r: 120, b: 48, l: 56 };
  const rows = ranking || [];
  const xs = rows.map((r) => r.delitos || 0);
  const ys = rows.map((r) => r.arrestos || 0);
  const { minV: minX, maxV: maxX } = niceDomain(xs);
  const { minV: minY, maxV: maxY } = niceDomain(ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const color = {
    rojo: "#ef4444",
    verde: "#22c55e",
    amarillo: "#f59e0b",
    neutro: "#7c5cbf",
  };

  const toX = (v) => pad.l + ((v - minX) / spanX) * innerW;
  const toY = (v) => pad.t + innerH - ((v - minY) / spanY) * innerH;

  const midX = xs.length
    ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    : (minX + maxX) / 2;
  const midY = ys.length
    ? [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)]
    : (minY + maxY) / 2;

  const xTicks = [minX, (minX + maxX) / 2, maxX].map((v) => Math.round(v));
  const yTicks = [minY, (minY + maxY) / 2, maxY].map((v) => Math.round(v));

  // Evita solapamiento vertical de etiquetas
  const placed = rows.map((r, idx) => {
    const x = toX(r.delitos || 0);
    const y = toY(r.arrestos || 0);
    const nearRight = x > pad.l + innerW * 0.62;
    return {
      ...r,
      idx,
      x,
      y,
      labelLeft: nearRight,
      labelY: y,
    };
  });
  placed.sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i += 1) {
    const gap = placed[i].labelY - placed[i - 1].labelY;
    if (Math.abs(gap) < 16) {
      placed[i].labelY = placed[i - 1].labelY + 16;
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dz-scatter-svg" role="img" aria-label="Matriz de eficiencia">
      <rect x="0" y="0" width={w} height={h} fill="#fafbfc" rx="8" />

      {/* grid suave */}
      {xTicks.map((tick) => (
        <line
          key={`gx-${tick}`}
          x1={toX(tick)}
          x2={toX(tick)}
          y1={pad.t}
          y2={pad.t + innerH}
          stroke="#eef2f7"
        />
      ))}
      {yTicks.map((tick) => (
        <line
          key={`gy-${tick}`}
          x1={pad.l}
          x2={pad.l + innerW}
          y1={toY(tick)}
          y2={toY(tick)}
          stroke="#eef2f7"
        />
      ))}

      {/* ejes */}
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={pad.l + innerW}
        y2={pad.t + innerH}
        stroke="#94a3b8"
        strokeWidth="1.25"
      />
      <line
        x1={pad.l}
        y1={pad.t}
        x2={pad.l}
        y2={pad.t + innerH}
        stroke="#94a3b8"
        strokeWidth="1.25"
      />

      {/* medianas de los datos */}
      <line
        x1={toX(midX)}
        x2={toX(midX)}
        y1={pad.t}
        y2={pad.t + innerH}
        stroke="#cbd5e1"
        strokeDasharray="5 4"
      />
      <line
        x1={pad.l}
        x2={pad.l + innerW}
        y1={toY(midY)}
        y2={toY(midY)}
        stroke="#cbd5e1"
        strokeDasharray="5 4"
      />

      {/* ticks */}
      {xTicks.map((tick) => (
        <text key={`xt-${tick}`} x={toX(tick)} y={h - 22} textAnchor="middle" className="dz-tick">
          {tick}
        </text>
      ))}
      {yTicks.map((tick) => (
        <text key={`yt-${tick}`} x={pad.l - 8} y={toY(tick) + 3} textAnchor="end" className="dz-tick">
          {tick}
        </text>
      ))}

      <text x={pad.l + innerW / 2} y={h - 6} textAnchor="middle" className="dz-axis">
        Delitos reportados →
      </text>
      <text
        x={14}
        y={pad.t + innerH / 2}
        textAnchor="middle"
        className="dz-axis"
        transform={`rotate(-90 14 ${pad.t + innerH / 2})`}
      >
        Arrestos (efectividad) →
      </text>

      {placed.map((r) => {
        const label = shortDistrict(r.distrito);
        const lx = r.labelLeft ? r.x - 12 : r.x + 12;
        const anchor = r.labelLeft ? "end" : "start";
        return (
          <g key={r.distrito}>
            <circle
              cx={r.x}
              cy={r.y}
              r="9"
              fill={color[r.cuadrante] || color.neutro}
              fillOpacity="0.9"
              stroke="#fff"
              strokeWidth="2"
            />
            <text x={r.x} y={r.y + 3.5} textAnchor="middle" className="dz-scatter-idx">
              {r.idx + 1}
            </text>
            <text x={lx} y={r.labelY + 1} textAnchor={anchor} className="dz-scatter-label">
              {label}
            </text>
            <text x={lx} y={r.labelY + 12} textAnchor={anchor} className="dz-scatter-meta">
              {r.delitos || 0} del. · {r.arrestos || 0} arr.
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
