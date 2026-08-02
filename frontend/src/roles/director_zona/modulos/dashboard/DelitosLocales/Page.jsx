import { Link } from "react-router-dom";
import "./DelitosLocales.css";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";

const DONUT_COLORS = ["#7c5cbf", "#3b82f6", "#f59e0b", "#ef4444", "#14b8a6", "#8b5cf6", "#64748b"];

const NIVEL_COLOR = {
  critico: "#ef4444",
  alto: "#f59e0b",
  medio: "#eab308",
  bajo: "#22c55e",
};

function LineChart({ series }) {
  const w = 640;
  const h = 220;
  const pad = { t: 16, r: 16, b: 36, l: 40 };
  const data = series?.length ? series : [{ fecha: "—", total: 0 }];
  const maxY = Math.max(1, ...data.map((d) => Number(d.total) || 0));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const pts = data.map((d, i) => {
    const x = pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = pad.t + innerH - ((Number(d.total) || 0) / maxY) * innerH;
    return { x, y, ...d };
  });

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area =
    pts.length > 0
      ? `${line} L ${pts[pts.length - 1].x} ${pad.t + innerH} L ${pts[0].x} ${pad.t + innerH} Z`
      : "";

  const tickIdx = [];
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) tickIdx.push(i);
  if (data.length > 1 && tickIdx[tickIdx.length - 1] !== data.length - 1) {
    tickIdx.push(data.length - 1);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dz-chart-svg" role="img" aria-label="Evolución del delito">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="#eef2f7" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" className="dz-axis">
              {Math.round(maxY * t)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#dzLineFill)" />
      <path d={line} fill="none" stroke="#7c5cbf" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#7c5cbf" />
      ))}
      {tickIdx.map((i) => (
        <text key={i} x={pts[i].x} y={h - 10} textAnchor="middle" className="dz-axis">
          {(data[i].fecha || "").slice(5)}
        </text>
      ))}
      <defs>
        <linearGradient id="dzLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c5cbf" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7c5cbf" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Donut({ items, total }) {
  const rows = items?.length ? items : [];
  let acc = 0;
  const segments = rows.map((r, i) => {
    const pct = total ? (r.total / total) * 100 : 0;
    const start = acc;
    acc += pct;
    return { ...r, start, end: acc, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  const bg =
    segments.length === 0
      ? "conic-gradient(#e5e7eb 0deg 360deg)"
      : `conic-gradient(${segments
          .map((s) => `${s.color} ${(s.start / 100) * 360}deg ${(s.end / 100) * 360}deg`)
          .join(", ")})`;

  return (
    <div className="dz-donut-wrap">
      <div className="dz-donut" style={{ background: bg }}>
        <div className="dz-donut-hole">
          <span>Total</span>
          <strong>{(total || 0).toLocaleString("es-EC")}</strong>
        </div>
      </div>
      <ul className="dz-donut-legend">
        {segments.map((s) => (
          <li key={s.tipo_delito}>
            <i style={{ background: s.color }} />
            <div>
              <strong>
                {s.tipo_delito} <em>{s.pct}%</em>
              </strong>
              <small>{s.total} casos</small>
            </div>
          </li>
        ))}
        {!segments.length && <li className="dz-empty-inline">Sin tipologías en el rango.</li>}
      </ul>
    </div>
  );
}

export default function DelitosLocales({ panel, loading }) {
  const evo = panel?.evolucion || [];
  const tip = panel?.tipologia || [];
  const bars = panel?.ranking_barras || [];
  const resumen = panel?.resumen_ejecutivo || [];
  const total = tip.reduce((a, b) => a + (b.total || 0), 0) || panel?.kpis?.indice_delictivo?.total || 0;
  const maxBar = Math.max(1, ...bars.map((b) => b.total || 0));

  if (loading && !panel) {
    return <p className="mod-muted">Cargando delitos locales…</p>;
  }

  return (
    <div className="dz-delitos">
      <div className="dz-delitos-top">
        <article className="dz-card dz-card-wide">
          <div className="dz-card-head">
            <h3>Evolución del Delito en el Tiempo</h3>
            <span className="dz-chip">Diario</span>
          </div>
          <LineChart series={evo} />
        </article>
        <article className="dz-card">
          <div className="dz-card-head">
            <h3>Tipología Criminal</h3>
          </div>
          <Donut items={tip} total={total} />
        </article>
      </div>

      <div className="dz-delitos-bot">
        <article className="dz-card dz-card-wide">
          <div className="dz-card-head">
            <h3>Ranking de Distritos por Incidencia</h3>
            <div className="dz-nivel-legend">
              <span><i className="n critico" /> Crítico</span>
              <span><i className="n alto" /> Alto</span>
              <span><i className="n medio" /> Medio</span>
              <span><i className="n bajo" /> Bajo</span>
            </div>
          </div>
          <div className="dz-hbars">
            {bars.length === 0 ? (
              <p className="dz-empty-inline">Sin distritos con incidencia en el rango.</p>
            ) : (
              bars.map((b) => (
                <div key={b.distrito} className="dz-hbar-row">
                  <span className="dz-hbar-label" title={b.distrito}>
                    {b.distrito}
                  </span>
                  <div className="dz-hbar-track">
                    <div
                      className="dz-hbar-fill"
                      style={{
                        width: `${Math.max(4, (b.total / maxBar) * 100)}%`,
                        background: NIVEL_COLOR[b.nivel] || "#7c5cbf",
                      }}
                    />
                  </div>
                  <span className="dz-hbar-val">{b.total}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dz-card">
          <div className="dz-card-head">
            <h3>Resumen Ejecutivo</h3>
          </div>
          <ul className="dz-exec">
            {resumen.map((r, i) => (
              <li key={i} className={`tone-${r.tone || "info"}`}>
                <MaterialIcon name={r.icon || "info"} />
                <span>{r.texto}</span>
              </li>
            ))}
            {!resumen.length && (
              <li className="tone-info">
                <MaterialIcon name="info" />
                <span>Aplique filtros o espere datos de ClickHouse para el resumen.</span>
              </li>
            )}
          </ul>
          <Link className="dz-exec-link" to="/app/director_zona/reportes">
            Ver reporte completo
            <MaterialIcon name="arrow_forward" />
          </Link>
        </article>
      </div>
    </div>
  );
}
