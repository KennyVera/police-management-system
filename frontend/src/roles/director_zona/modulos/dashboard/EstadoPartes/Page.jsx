import "./EstadoPartes.css";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { glassCard, kpiCard } from "../../../../../shared/ui/saas";

const TONE_COLORS = {
  ok: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  muted: "#9ca3af",
  info: "#7c5cbf",
};

function Donut({ slices, centerLabel, centerValue }) {
  const total = slices.reduce((s, x) => s + (x.value || 0), 0) || 1;
  let angle = -90;
  const segments = slices
    .filter((x) => x.value > 0)
    .map((x) => {
      const span = (x.value / total) * 360;
      const start = angle;
      angle += span;
      return { ...x, start, span };
    });

  const gradient =
    segments.length === 0
      ? "#e5e7eb"
      : `conic-gradient(${segments
          .map((s) => `${s.color} ${s.start}deg ${s.start + s.span}deg`)
          .join(", ")})`;

  return (
    <div className="dz-ep-donut-wrap">
      <div className="dz-ep-donut" style={{ background: gradient }}>
        <div className="dz-ep-donut-hole">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="dz-ep-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <div>
              <strong>
                {s.label} <em>{s.pct}%</em>
              </strong>
              <small>{s.value.toLocaleString("es-EC")} partes</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ evolucion }) {
  const rows = evolucion || [];
  if (!rows.length) {
    return <p className="dz-empty-inline">Sin serie diaria en el rango.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.total || 0));
  // Mostrar como máximo ~24 barras (muestreo uniforme)
  const step = Math.max(1, Math.ceil(rows.length / 24));
  const sample = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);

  return (
    <div className="dz-ep-bars">
      {sample.map((r) => {
        const h = Math.max(4, Math.round(((r.total || 0) / max) * 100));
        const label = String(r.fecha || "").slice(5);
        return (
          <div key={r.fecha} className="dz-ep-bar-col" title={`${r.fecha}: ${r.total}`}>
            <div className="dz-ep-bar-stack" style={{ height: `${h}%` }}>
              <span
                className="seg ok"
                style={{
                  flex: Math.max(r.aprobado || 0, 0.01),
                }}
              />
              <span
                className="seg warn"
                style={{
                  flex: Math.max(r.pendiente || 0, 0.01),
                }}
              />
              <span
                className="seg danger"
                style={{
                  flex: Math.max(r.observado || 0, 0.01),
                }}
              />
            </div>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

export default function EstadoPartes({ data, loading }) {
  if (loading && !data) {
    return <p className="mod-muted">Cargando estado de partes…</p>;
  }
  if (!data) {
    return <p className="dz-empty-inline">Sin datos de estado de partes.</p>;
  }

  const slices = (data.por_estado || []).map((r) => ({
    key: r.estado,
    label: r.label,
    value: r.total || 0,
    pct: r.pct || 0,
    color: TONE_COLORS[r.tone] || TONE_COLORS.muted,
  }));

  return (
    <div className="dz-estado">
      <div className="dz-estado-kpis grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={`dz-card dz-ep-kpi tone-purple ${kpiCard}`}>
          <p className="dz-kpi-label">Tasa de resolución</p>
          <p className="dz-kpi-main">
            {data.tasa_resolucion ?? 0}%
            <span>Aprobados / flujo de revisión</span>
          </p>
        </article>
        <article className={`dz-card dz-ep-kpi tone-green ${kpiCard}`}>
          <p className="dz-kpi-label">Aprobados</p>
          <p className="dz-kpi-main">
            {(data.aprobado ?? 0).toLocaleString("es-EC")}
            <span>Control de calidad OK</span>
          </p>
        </article>
        <article className={`dz-card dz-ep-kpi tone-orange ${kpiCard}`}>
          <p className="dz-kpi-label">Pendientes</p>
          <p className="dz-kpi-main">
            {(data.pendiente ?? 0).toLocaleString("es-EC")}
            <span>En bandeja de supervisor</span>
          </p>
        </article>
        <article className={`dz-card dz-ep-kpi tone-red ${kpiCard}`}>
          <p className="dz-kpi-label">Devueltos</p>
          <p className="dz-kpi-main">
            {(data.observado ?? 0).toLocaleString("es-EC")}
            <span>Observados / rechazados</span>
          </p>
        </article>
      </div>

      <div className="dz-estado-grid grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className={`dz-card ${glassCard}`}>
          <div className="dz-card-head">
            <h3>Estado de partes</h3>
            <span className="dz-chip">Postgres · zona</span>
          </div>
          <Donut
            slices={slices}
            centerValue={(data.total ?? 0).toLocaleString("es-EC")}
            centerLabel="Total"
          />
        </article>

        <article className={`dz-card ${glassCard}`}>
          <div className="dz-card-head">
            <h3>Flujo diario (sin borradores)</h3>
            <span className="dz-chip">Ap · Pe · De</span>
          </div>
          <div className="dz-ep-legend-mini">
            <span>
              <i className="ok" /> Aprobado
            </span>
            <span>
              <i className="warn" /> Pendiente
            </span>
            <span>
              <i className="danger" /> Devuelto
            </span>
          </div>
          <Bars evolucion={data.evolucion || []} />
          <p className="dz-ep-note">
            <MaterialIcon name="info" />
            {data.nota ||
              "Tasa = Aprobados ÷ (Aprobados + Pendientes + Devueltos)."}
          </p>
        </article>
      </div>
    </div>
  );
}
