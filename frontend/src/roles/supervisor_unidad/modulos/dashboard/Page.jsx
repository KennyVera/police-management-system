import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useAuth } from "../../../../auth/AuthContext";
import { useTheme } from "../../../../shared/theme/ThemeContext";
import { supervisorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Dashboard.css";

const EMPTY = {
  kpis: {
    fuerza_efectiva: { porcentaje: 0, activos: 0, total: 0, delta_ayer_pct: null },
    control_calidad: { pendientes: 0, revisados_hoy: 0, procesados_pct: 0 },
    flota: { porcentaje: 0, operativos: 0, total: 0, en_mantenimiento: 0 },
    alertas_criticas: { total: 0 },
  },
  calidad_partes: {
    total: 0,
    aprobados: 0,
    pendientes: 0,
    devueltos: 0,
    aprobados_pct: 0,
    pendientes_pct: 0,
    devueltos_pct: 0,
    calidad_ok: true,
  },
  partes_revision: [],
  actividad_escuadras: [],
  distribucion_sectores: [],
  turno: { inicio: "07:00", fin: "19:00" },
};

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function fechaEsp(iso) {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Conic-gradient donut from percentages (0–100). Empty → soft gray ring. */
function donutStyle(calidad, isDark) {
  const a = Number(calidad.aprobados_pct) || 0;
  const p = Number(calidad.pendientes_pct) || 0;
  const d = Number(calidad.devueltos_pct) || 0;
  const sum = a + p + d;
  if (!sum || !calidad.total) {
    return {
      background: `conic-gradient(${isDark ? "#3a3a3a" : "#e5e7eb"} 0deg 360deg)`,
    };
  }
  const aEnd = (a / 100) * 360;
  const pEnd = aEnd + (p / 100) * 360;
  return {
    background: `conic-gradient(
      #22c55e 0deg ${aEnd}deg,
      #f59e0b ${aEnd}deg ${pEnd}deg,
      #ef4444 ${pEnd}deg 360deg
    )`,
  };
}

function ProgressBar({ value, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`sup-progress tone-${tone}`}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

function SectorMap({ sectores, isDark }) {
  const palette = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#14b8a6"];
  const items = sectores?.length
    ? sectores
    : [
        { sector: "Sector Norte", patrullas: 0 },
        { sector: "Sector Centro", patrullas: 0 },
        { sector: "Sector Sur", patrullas: 0 },
      ];
  const mapBg = isDark ? "#141414" : "#f3f6fb";
  const dotFill = isDark ? "#3a3a3a" : "#dbe3f0";
  const labelBg = isDark ? "#1a1a1a" : "#fff";
  const labelStroke = isDark ? "#2e2e2e" : "#e5e7eb";

  return (
    <div className="sup-map">
      <svg viewBox="0 0 420 240" className="sup-map-svg" aria-hidden="true">
        <defs>
          <pattern id="gridDots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill={dotFill} />
          </pattern>
        </defs>
        <rect width="420" height="240" fill={mapBg} rx="12" />
        <rect width="420" height="240" fill="url(#gridDots)" opacity="0.7" />
        {/* stylized zones */}
        <path
          d="M40 40 L210 28 L200 130 L55 145 Z"
          fill={palette[0]}
          fillOpacity={items[0]?.patrullas ? 0.35 : 0.12}
          stroke={palette[0]}
          strokeWidth="2"
        />
        <path
          d="M210 28 L380 50 L365 150 L200 130 Z"
          fill={palette[1]}
          fillOpacity={items[1]?.patrullas ? 0.35 : 0.12}
          stroke={palette[1]}
          strokeWidth="2"
        />
        <path
          d="M55 145 L200 130 L365 150 L340 210 L70 215 Z"
          fill={palette[2]}
          fillOpacity={items[2]?.patrullas ? 0.35 : 0.12}
          stroke={palette[2]}
          strokeWidth="2"
        />
        {items.slice(0, 3).map((s, i) => {
          const centers = [
            [120, 85],
            [290, 90],
            [210, 175],
          ];
          const [cx, cy] = centers[i];
          return (
            <g key={s.sector}>
              <rect
                x={cx - 54}
                y={cy - 22}
                width="108"
                height="44"
                rx="8"
                fill={labelBg}
                fillOpacity="0.92"
                stroke={labelStroke}
              />
              <text x={cx} y={cy - 4} textAnchor="middle" className="sup-map-label">
                {s.sector}
              </text>
              <text x={cx} y={cy + 14} textAnchor="middle" className="sup-map-value">
                {s.patrullas} patrullas
              </text>
            </g>
          );
        })}
      </svg>
      <div className="sup-map-legend">
        <span>
          <i className="dot green" /> Patrulla activa
        </span>
        <span>
          <i className="dot yellow" /> Patrulla en mantenimiento
        </span>
        <span>
          <i className="dot red" /> Patrulla fuera de servicio
        </span>
      </div>
    </div>
  );
}

export default function Page() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const name = user?.first_name || "Supervisor";
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supervisorApi
      .dashboard()
      .then((d) => {
        if (!alive) return;
        setData({
          ...EMPTY,
          ...d,
          kpis: { ...EMPTY.kpis, ...(d.kpis || {}) },
          calidad_partes: { ...EMPTY.calidad_partes, ...(d.calidad_partes || {}) },
          turno: { ...EMPTY.turno, ...(d.turno || {}) },
          partes_revision: d.partes_revision || [],
          actividad_escuadras: d.actividad_escuadras || [],
          distribucion_sectores: d.distribucion_sectores || [],
        });
      })
      .catch(() => {
        if (alive) setData(EMPTY);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const k = data.kpis;
  const calidad = data.calidad_partes;
  const fechaLabel = useMemo(
    () => fechaEsp(data.fecha_iso),
    [data.fecha_iso]
  );

  const bars = data.actividad_escuadras;
  const maxBar = Math.max(1, ...bars.map((b) => Number(b.total) || 0));
  const topEscuadra = bars.reduce(
    (best, cur) => ((cur.total || 0) > (best?.total || 0) ? cur : best),
    null
  );

  return (
    <div className={`sup-dash${loading ? " is-loading" : ""}`}>
      <header className="sup-hero">
        <div>
          <h2>
            Hola, {name} <span aria-hidden="true">👋</span>
          </h2>
          <p>Aquí tienes el resumen operativo de tu unidad al día de hoy.</p>
        </div>
        <div className="sup-meta">
          <span className="sup-chip muted">
            <MaterialIcon name="calendar_today" />
            {fechaLabel}
          </span>
          <span className="sup-chip accent">
            Turno: {data.turno?.inicio || "07:00"} – {data.turno?.fin || "19:00"}
          </span>
        </div>
      </header>

      <section className="sup-kpi-row">
        <article className="sup-kpi tone-green">
          <div className="sup-kpi-head">
            <div className="sup-kpi-icon">
              <MaterialIcon name="groups" />
            </div>
            <div>
              <p className="sup-kpi-label">Fuerza Efectiva</p>
              <p className="sup-kpi-main">{k.fuerza_efectiva.porcentaje}%</p>
              <p className="sup-kpi-sub">
                {k.fuerza_efectiva.activos} / {k.fuerza_efectiva.total} agentes activos
              </p>
            </div>
          </div>
          <ProgressBar value={k.fuerza_efectiva.porcentaje} tone="green" />
          <p className="sup-kpi-foot muted">
            {k.fuerza_efectiva.delta_ayer_pct != null ? (
              <>
                <MaterialIcon name="trending_up" />
                {k.fuerza_efectiva.delta_ayer_pct > 0 ? "+" : ""}
                {k.fuerza_efectiva.delta_ayer_pct}% respecto a ayer
              </>
            ) : (
              <>Sin comparación con ayer aún</>
            )}
          </p>
        </article>

        <article className="sup-kpi tone-blue">
          <div className="sup-kpi-head">
            <div className="sup-kpi-icon">
              <MaterialIcon name="assignment" />
            </div>
            <div>
              <p className="sup-kpi-label">Control de Calidad</p>
              <p className="sup-kpi-main">
                {k.control_calidad.pendientes}{" "}
                <span className="sup-kpi-unit">Pendientes</span>
              </p>
              <p className="sup-kpi-sub">
                {k.control_calidad.revisados_hoy} revisados hoy
              </p>
            </div>
          </div>
          <ProgressBar value={k.control_calidad.procesados_pct} tone="blue" />
          <p className="sup-kpi-foot ok">
            <MaterialIcon name="check_circle" />
            {k.control_calidad.procesados_pct}% de partes procesados
          </p>
        </article>

        <article className="sup-kpi tone-teal">
          <div className="sup-kpi-head">
            <div className="sup-kpi-icon">
              <MaterialIcon name="local_taxi" />
            </div>
            <div>
              <p className="sup-kpi-label">Operatividad de Flota</p>
              <p className="sup-kpi-main">{k.flota.porcentaje}%</p>
              <p className="sup-kpi-sub">
                {k.flota.operativos} / {k.flota.total} patrulleros operativos
              </p>
            </div>
          </div>
          <ProgressBar value={k.flota.porcentaje} tone="teal" />
          <p className="sup-kpi-foot warn">
            <MaterialIcon name="build" />
            {k.flota.en_mantenimiento} en mantenimiento
          </p>
        </article>

        <article className="sup-kpi tone-red">
          <div className="sup-kpi-head">
            <div className="sup-kpi-icon">
              <MaterialIcon name="warning" />
            </div>
            <div>
              <p className="sup-kpi-label">Alertas Críticas</p>
              <p className="sup-kpi-main">{k.alertas_criticas.total}</p>
              <p className="sup-kpi-sub">novedades requieren atención</p>
            </div>
          </div>
          <div className="sup-kpi-accent-line" />
          <Link
            to="/app/supervisor_unidad/despacho_operativo/auxilios"
            className="sup-kpi-link danger"
          >
            Ver alertas <MaterialIcon name="arrow_forward" />
          </Link>
        </article>
      </section>

      <section className="sup-mid-row">
        <article className="sup-card">
          <h3>Control de Calidad de Partes (Hoy)</h3>
          <div className="sup-calidad">
            <div className="sup-donut-wrap">
              <div className="sup-donut" style={donutStyle(calidad, isDark)}>
                <div className="sup-donut-hole">
                  <span>Total</span>
                  <strong>{calidad.total}</strong>
                  <em>partes</em>
                </div>
              </div>
            </div>
            <ul className="sup-legend">
              <li>
                <span className="lg-dot green" />
                <div>
                  <strong>
                    Aprobados <em>{calidad.aprobados_pct}%</em>{" "}
                    <small>({calidad.aprobados})</small>
                  </strong>
                  <p>Partes correctos y aprobados</p>
                </div>
              </li>
              <li>
                <span className="lg-dot yellow" />
                <div>
                  <strong>
                    Pendientes <em>{calidad.pendientes_pct}%</em>{" "}
                    <small>({calidad.pendientes})</small>
                  </strong>
                  <p>En revisión por el supervisor</p>
                </div>
              </li>
              <li>
                <span className="lg-dot red" />
                <div>
                  <strong>
                    Devueltos <em>{calidad.devueltos_pct}%</em>{" "}
                    <small>({calidad.devueltos})</small>
                  </strong>
                  <p>Partes con errores a corregir</p>
                </div>
              </li>
            </ul>
          </div>
          <div className={`sup-banner ${calidad.calidad_ok ? "ok" : "warn"}`}>
            <MaterialIcon name={calidad.calidad_ok ? "check_circle" : "error"} />
            {calidad.total === 0
              ? "Aún no hay partes registrados hoy. Los indicadores se actualizarán solos."
              : calidad.calidad_ok
                ? "La calidad de los partes está dentro del rango aceptable."
                : "Hay demasiados partes devueltos. Revisa observaciones con tu unidad."}
          </div>
        </article>

        <article className="sup-card">
          <h3>Últimos Partes para Revisión</h3>
          <div className="sup-table-wrap">
            <table className="sup-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Agente</th>
                  <th>Tipo de Delito</th>
                  <th>Sector</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.partes_revision.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="sup-empty">
                      No hay partes pendientes de revisión.
                    </td>
                  </tr>
                ) : (
                  data.partes_revision.map((row) => (
                    <tr key={row.id}>
                      <td>{row.hora}</td>
                      <td>{row.agente}</td>
                      <td>{row.tipo_delito}</td>
                      <td>{row.sector}</td>
                      <td>
                        <span className="badge-pendiente">{row.estado}</span>
                      </td>
                      <td>
                        <Link
                          to={`/app/supervisor_unidad/control_calidad/pendientes?parte=${row.id}`}
                          className="btn-revisar"
                        >
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link
            to="/app/supervisor_unidad/control_calidad/pendientes"
            className="sup-footer-link"
          >
            Ver todos los partes pendientes
          </Link>
        </article>
      </section>

      <section className="sup-bot-row">
        <article className="sup-card">
          <h3>Actividad por Escuadra (Hoy)</h3>
          <div className="sup-bars">
            {bars.length === 0 ? (
              <p className="sup-empty">Sin escuadras registradas para hoy.</p>
            ) : (
              bars.map((b) => (
                <div key={b.nombre} className="sup-bar-row">
                  <span className="sup-bar-label">{b.nombre}</span>
                  <div className="sup-bar-track">
                    <div
                      className="sup-bar-fill"
                      style={{
                        width: `${Math.max(
                          b.total ? 8 : 0,
                          (Number(b.total) / maxBar) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="sup-bar-val">{b.total}</span>
                </div>
              ))
            )}
            {bars.length > 0 && (
              <div className="sup-bars-axis">
                <span>0</span>
                <span>Número de asignaciones</span>
                <span>{maxBar}</span>
              </div>
            )}
          </div>
          <div className="sup-banner accent">
            <MaterialIcon name="description" />
            {topEscuadra && topEscuadra.total > 0
              ? `La ${topEscuadra.nombre} lidera en actividad del día.`
              : "Cuando registres escuadras y asignaciones, verás el ranking aquí."}
          </div>
        </article>

        <article className="sup-card">
          <h3>Distribución Operativa por Sector</h3>
          <SectorMap sectores={data.distribucion_sectores} isDark={isDark} />
        </article>
      </section>
    </div>
  );
}
