import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Dashboard.css";

const EMPTY = {
  periodo: { clave: "mes", label: "Este mes", desde: "", hasta: "" },
  kpis: {
    casos_activos: { total: 0, hint: "Expedientes abiertos", nota: "Bajo su responsabilidad." },
    efectividad: { cerrados: 0, hint: "Casos cerrados este periodo", delta_pct: null },
    tiempo_resolucion: { dias: 0, hint: "Días por caso" },
    estancamiento: { total: 0, hint: "Casos en rojo: sin actividad en más de 15 días.", umbral_dias: 15 },
  },
  estado_procesal: {
    total: 0,
    indagacion: { total: 0, pct: 0, label: "En Indagación Previa", desc: "Fase de recolección de indicios" },
    instruccion: { total: 0, pct: 0, label: "En Instrucción Fiscal", desc: "Investigación formal en curso" },
    suspendidos: { total: 0, pct: 0, label: "Suspendidos", desc: "Por disposición fiscal o judicial" },
  },
  tipologia_delitos: [],
  casos_prioritarios: [],
};

const FILTRO_CRITICOS = "__CRITICOS__";

function donutStyle(estado) {
  const a = Number(estado?.indagacion?.pct) || 0;
  const b = Number(estado?.instruccion?.pct) || 0;
  if (!estado?.total) {
    return { background: "conic-gradient(#e5e7eb 0deg 360deg)" };
  }
  const aEnd = (a / 100) * 360;
  const bEnd = aEnd + (b / 100) * 360;
  return {
    background: `conic-gradient(
      #3b82f6 0deg ${aEnd}deg,
      #f59e0b ${aEnd}deg ${bEnd}deg,
      #9ca3af ${bEnd}deg 360deg
    )`,
  };
}

function formatRango(desde, hasta) {
  if (!desde || !hasta) return "—";
  try {
    const d0 = new Date(`${desde}T12:00:00`);
    const d1 = new Date(`${hasta}T12:00:00`);
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    return `${d0.toLocaleDateString("es-EC", opts)} – ${d1.toLocaleDateString("es-EC", opts)}`;
  } catch {
    return `${desde} – ${hasta}`;
  }
}

function exportPrioritariosCsv(rows, periodo) {
  const header = [
    "N Expediente",
    "Delito / Título",
    "Última actividad",
    "Estado",
    "Días sin actividad",
    "Crítico",
  ];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.numero_expediente,
        `"${(r.delito || "").replace(/"/g, '""')}"`,
        r.ultima_actividad_rel || "",
        r.estado_label || "",
        r.dias_sin_actividad ?? "",
        r.critico ? "SI" : "NO",
      ].join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `casos-prioritarios-${periodo?.desde || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DetectiveDashboard() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("mes");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    detectiveApi
      .dashboard({ periodo })
      .then((d) => {
        if (!alive) return;
        setData({
          ...EMPTY,
          ...d,
          kpis: { ...EMPTY.kpis, ...(d.kpis || {}) },
          estado_procesal: {
            ...EMPTY.estado_procesal,
            ...(d.estado_procesal || {}),
            indagacion: { ...EMPTY.estado_procesal.indagacion, ...(d.estado_procesal?.indagacion || {}) },
            instruccion: { ...EMPTY.estado_procesal.instruccion, ...(d.estado_procesal?.instruccion || {}) },
            suspendidos: { ...EMPTY.estado_procesal.suspendidos, ...(d.estado_procesal?.suspendidos || {}) },
          },
          periodo: { ...EMPTY.periodo, ...(d.periodo || {}) },
          tipologia_delitos: d.tipologia_delitos || [],
          casos_prioritarios: d.casos_prioritarios || [],
        });
        setError("");
      })
      .catch((e) => {
        if (alive) setError(e.message || "No se pudo cargar el dashboard");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodo]);

  const k = data.kpis;
  const ep = data.estado_procesal;
  const bars = data.tipologia_delitos;
  const maxBar = Math.max(1, ...bars.map((b) => Number(b.total) || 0));

  const casosFiltrados = useMemo(() => {
    if (filtroEstado === FILTRO_CRITICOS) {
      return data.casos_prioritarios.filter((c) => c.critico);
    }
    if (!filtroEstado) return data.casos_prioritarios;
    return data.casos_prioritarios.filter((c) => c.estado === filtroEstado);
  }, [data.casos_prioritarios, filtroEstado]);

  function abrirMesa(caso) {
    if (!caso?.id) return;
    navigate(`/app/detective/casos?mesa=${caso.id}`);
  }

  function scrollToTabla() {
    document.getElementById("det-casos-prioritarios")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className={`det-dash${loading ? " is-loading" : ""}`}>
      <header className="det-toolbar">
        <div>
          <p className="det-kicker">Resumen de carga laboral</p>
          <h2>Panel de investigación</h2>
        </div>
        <div className="det-filters">
          <label className="det-field">
            <span>Periodo</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="mes">Este mes</option>
              <option value="trimestre">Este trimestre</option>
              <option value="anio">Este año</option>
            </select>
          </label>
          <div className="det-range">
            <MaterialIcon name="calendar_month" />
            <span>{formatRango(data.periodo?.desde, data.periodo?.hasta)}</span>
          </div>
          <button
            type="button"
            className="det-export"
            onClick={() => exportPrioritariosCsv(data.casos_prioritarios, data.periodo)}
            disabled={!data.casos_prioritarios.length}
          >
            <MaterialIcon name="download" />
            Exportar
          </button>
        </div>
      </header>

      {error && <p className="det-error">{error}</p>}

      <section className="det-kpi-row">
        <article className="det-kpi tone-purple">
          <div className="det-kpi-icon">
            <MaterialIcon name="folder_open" />
          </div>
          <div>
            <p className="det-kpi-main">
              {k.casos_activos.total} <span>Casos Activos</span>
            </p>
            <p className="det-kpi-sub">{k.casos_activos.hint}</p>
            <p className="det-kpi-note">{k.casos_activos.nota}</p>
          </div>
        </article>

        <article className="det-kpi tone-green">
          <div className="det-kpi-icon">
            <MaterialIcon name="trending_up" />
          </div>
          <div>
            <p className="det-kpi-main">
              {k.efectividad.cerrados} <span>Tasa de Efectividad</span>
            </p>
            <p className="det-kpi-sub">{k.efectividad.hint}</p>
            {k.efectividad.delta_pct != null ? (
              <p className={`det-delta ${k.efectividad.delta_pct >= 0 ? "up" : "down"}`}>
                <MaterialIcon name={k.efectividad.delta_pct >= 0 ? "arrow_upward" : "arrow_downward"} />
                {k.efectividad.delta_pct > 0 ? "+" : ""}
                {k.efectividad.delta_pct}% vs periodo anterior
              </p>
            ) : (
              <p className="det-kpi-note">Sin comparación aún</p>
            )}
          </div>
        </article>

        <article className="det-kpi tone-blue">
          <div className="det-kpi-icon">
            <MaterialIcon name="schedule" />
          </div>
          <div>
            <p className="det-kpi-main">
              {k.tiempo_resolucion.dias} <span>Tiempo Promedio de Resolución</span>
            </p>
            <p className="det-kpi-sub">{k.tiempo_resolucion.hint}</p>
          </div>
        </article>

        <article className="det-kpi tone-red">
          <div className="det-kpi-icon">
            <MaterialIcon name="warning" />
          </div>
          <div>
            <p className="det-kpi-main">
              {k.estancamiento.total} <span>Alerta de Estancamiento</span>
            </p>
            <p className="det-kpi-sub">{k.estancamiento.hint}</p>
            <button
              type="button"
              className="det-link-danger"
              onClick={() => {
                setFiltroEstado(FILTRO_CRITICOS);
                scrollToTabla();
              }}
            >
              Ver casos críticos
              <MaterialIcon name="arrow_forward" />
            </button>
          </div>
        </article>
      </section>

      <section className="det-main-grid">
        <div className="det-left">
          <article className="det-card">
            <h3>Estado Procesal de Mis Casos Activos</h3>
            <div className="det-donut-block">
              <div className="det-donut" style={donutStyle(ep)}>
                <div className="det-donut-hole">
                  <span>Total</span>
                  <strong>{ep.total}</strong>
                  <em>casos</em>
                </div>
              </div>
              <ul className="det-legend">
                <li>
                  <i className="dot blue" />
                  <div>
                    <strong>
                      {ep.indagacion.label} <em>{ep.indagacion.pct}%</em>{" "}
                      <small>({ep.indagacion.total})</small>
                    </strong>
                    <p>{ep.indagacion.desc}</p>
                  </div>
                </li>
                <li>
                  <i className="dot orange" />
                  <div>
                    <strong>
                      {ep.instruccion.label} <em>{ep.instruccion.pct}%</em>{" "}
                      <small>({ep.instruccion.total})</small>
                    </strong>
                    <p>{ep.instruccion.desc}</p>
                  </div>
                </li>
                <li>
                  <i className="dot gray" />
                  <div>
                    <strong>
                      {ep.suspendidos.label} <em>{ep.suspendidos.pct}%</em>{" "}
                      <small>({ep.suspendidos.total})</small>
                    </strong>
                    <p>{ep.suspendidos.desc}</p>
                  </div>
                </li>
              </ul>
            </div>
          </article>

          <article className="det-card">
            <h3>Tipología de Delitos Investigados</h3>
            <div className="det-bars">
              {bars.length === 0 ? (
                <p className="det-empty">Sin tipologías aún. Se llenarán al asignar delitos a los casos.</p>
              ) : (
                bars.map((b) => (
                  <div key={b.nombre} className="det-bar-row">
                    <span className="det-bar-label" title={b.nombre}>
                      {b.nombre}
                    </span>
                    <div className="det-bar-track">
                      <div
                        className="det-bar-fill"
                        style={{
                          width: `${Math.max(b.total ? 6 : 0, (Number(b.total) / maxBar) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="det-bar-val">{b.total}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <article className="det-card det-table-card" id="det-casos-prioritarios">
          <div className="det-table-head">
            <h3>Mis Casos Prioritarios</h3>
            <div className="det-table-actions">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                <option value={FILTRO_CRITICOS}>Solo críticos (+15 días)</option>
                <option value="INDAGACION_PREVIA">En Indagación</option>
                <option value="INSTRUCCION_FISCAL">En Instrucción</option>
                <option value="SUSPENDIDO">Suspendidos</option>
              </select>
              <Link to="/app/detective/casos" className="det-ver-todos">
                Ver todos ({k.casos_activos.total})
              </Link>
            </div>
          </div>

          <div className="det-table-wrap">
            <table className="det-table">
              <thead>
                <tr>
                  <th>Nº Expediente</th>
                  <th>Delito / Título</th>
                  <th>Última Actividad</th>
                  <th>Estado</th>
                  <th>Días sin actividad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {casosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="det-empty">
                      No hay casos prioritarios en este filtro. Cuando asignen expedientes, aparecerán aquí.
                    </td>
                  </tr>
                ) : (
                  casosFiltrados.map((c) => (
                    <tr key={c.id} className={c.critico ? "is-critico" : ""}>
                      <td className="mono">{c.numero_expediente}</td>
                      <td>{c.delito}</td>
                      <td>{c.ultima_actividad_rel}</td>
                      <td>
                        <span className={`badge-estado tone-${c.estado_tone}`}>
                          {c.estado_label}
                        </span>
                      </td>
                      <td>
                        <span className={c.critico ? "dias-critico" : "dias-ok"}>
                          {c.dias_sin_actividad} días
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-mesa"
                          title="Abrir Mesa de Trabajo: espacio operativo del expediente"
                          onClick={() => abrirMesa(c)}
                        >
                          <MaterialIcon name="folder_open" />
                          Abrir Mesa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="det-banner warn">
            <MaterialIcon name="warning" />
            Los casos en rojo requieren actualización inmediata para evitar vencimientos procesales.
          </div>
        </article>
      </section>
    </div>
  );
}
