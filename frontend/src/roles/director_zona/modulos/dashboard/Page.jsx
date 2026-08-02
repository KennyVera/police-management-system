import { useCallback, useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Dashboard.css";
import DelitosLocales from "./DelitosLocales/Page";
import MapaCalor from "./MapaCalor/Page";
import RankingDistritos from "./RankingDistritos/Page";

function defaultRange() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - 30);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(desde), hasta: iso(hasta) };
}

function Trend({ value }) {
  if (value == null) return <p className="dz-trend flat">Sin comparación</p>;
  const up = value >= 0;
  return (
    <p className={`dz-trend ${up ? "up" : "down"}`}>
      <MaterialIcon name={up ? "trending_up" : "trending_down"} />
      {up ? "+" : ""}
      {value}% vs periodo anterior
    </p>
  );
}

export default function DirectorDashboard() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState("delitos");
  const [draft, setDraft] = useState({
    fecha_desde: initial.desde,
    fecha_hasta: initial.hasta,
    distrito: "",
    tipo_delito: "",
  });
  const [filters, setFilters] = useState(draft);
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (active = filters) => {
    setLoading(true);
    setError("");
    try {
      const data = await directorApi.panel(active);
      setPanel(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel táctico");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  function aplicar(e) {
    e?.preventDefault?.();
    setFilters({ ...draft });
  }

  function limpiar() {
    const range = defaultRange();
    const next = {
      fecha_desde: range.desde,
      fecha_hasta: range.hasta,
      distrito: "",
      tipo_delito: "",
    };
    setDraft(next);
    setFilters(next);
  }

  const zona = panel?.jurisdiccion?.nombre || "su zona";
  const k = panel?.kpis;
  const meta = panel?.meta || { distritos: [], tipos_delito: [] };

  return (
    <div className={`dz-dash${loading ? " is-loading" : ""}`}>
      <header className="dz-head">
        <div>
          <p className="dz-kicker">Inteligencia táctica — {zona}</p>
          <h2>Dashboard de zona</h2>
          <p className="dz-sub">
            Indicadores filtrados exclusivamente a su jurisdicción. ClickHouse responde en milisegundos.
          </p>
        </div>
        <button type="button" className="dz-refresh" onClick={() => load()} disabled={loading}>
          <MaterialIcon name="refresh" />
          Actualizar
          {panel?.actualizado_en && <small>· Hoy, {panel.actualizado_en}</small>}
        </button>
      </header>

      <form className="dz-filters" onSubmit={aplicar}>
        <label>
          Desde
          <input
            type="date"
            value={draft.fecha_desde}
            onChange={(e) => setDraft({ ...draft, fecha_desde: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={draft.fecha_hasta}
            onChange={(e) => setDraft({ ...draft, fecha_hasta: e.target.value })}
          />
        </label>
        <label>
          Distrito
          <select
            value={draft.distrito}
            onChange={(e) => setDraft({ ...draft, distrito: e.target.value })}
          >
            <option value="">Todos los distritos</option>
            {(meta.distritos || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de delito
          <select
            value={draft.tipo_delito}
            onChange={(e) => setDraft({ ...draft, tipo_delito: e.target.value })}
          >
            <option value="">Todos los delitos</option>
            {(meta.tipos_delito || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dz-btn-primary">
          <MaterialIcon name="filter_alt" />
          Aplicar filtros
        </button>
        <button type="button" className="dz-btn-ghost" onClick={limpiar}>
          Limpiar filtros
        </button>
      </form>

      <div className="dz-tabs">
        {[
          { id: "delitos", label: "Delitos Locales", icon: "monitoring" },
          { id: "mapa", label: "Mapa de Calor", icon: "map" },
          { id: "ranking", label: "Ranking Distritos", icon: "leaderboard" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <MaterialIcon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="dz-error">{error}</p>}

      {k && (
        <section className="dz-kpi-row">
          <article className="dz-kpi tone-purple">
            <div className="dz-kpi-icon">
              <MaterialIcon name="bar_chart" />
            </div>
            <div>
              <p className="dz-kpi-label">Índice Delictivo Global</p>
              <p className="dz-kpi-main">
                {(k.indice_delictivo?.total ?? 0).toLocaleString("es-EC")}
                <span>Total de incidentes</span>
              </p>
              <Trend value={k.indice_delictivo?.delta_pct} />
            </div>
          </article>

          <article className="dz-kpi tone-green">
            <div className="dz-kpi-icon">
              <MaterialIcon name="handshake" />
            </div>
            <div>
              <p className="dz-kpi-label">Efectividad Operativa</p>
              <p className="dz-kpi-main">
                {(k.efectividad?.detenidos ?? 0).toLocaleString("es-EC")}
                <span>Detenidos</span>
              </p>
              <Trend value={k.efectividad?.delta_pct} />
            </div>
          </article>

          <article className="dz-kpi tone-orange">
            <div className="dz-kpi-icon">
              <MaterialIcon name="crisis_alert" />
            </div>
            <div>
              <p className="dz-kpi-label">Delito de Mayor Impacto</p>
              <p className="dz-kpi-main">
                {k.mayor_impacto?.tipo_delito || "—"}
                <span>{k.mayor_impacto?.nota || "—"}</span>
              </p>
              <Trend value={k.mayor_impacto?.delta_pct} />
            </div>
          </article>

          <article className="dz-kpi tone-red">
            <div className="dz-kpi-icon">
              <MaterialIcon name="notifications_active" />
            </div>
            <div>
              <p className="dz-kpi-label">Zonas en Alerta Roja</p>
              <p className="dz-kpi-main">
                {k.alerta_roja?.total ?? 0}
                <span>Distritos críticos</span>
              </p>
              <button
                type="button"
                className="dz-kpi-link"
                onClick={() => setTab("ranking")}
              >
                Ver detalle
                <MaterialIcon name="arrow_forward" />
              </button>
            </div>
          </article>

          <article className="dz-kpi tone-blue">
            <div className="dz-kpi-icon">
              <MaterialIcon name="person_pin_circle" />
            </div>
            <div>
              <p className="dz-kpi-label">Fuerza Efectiva Desplegada</p>
              <p className="dz-kpi-main">
                {k.fuerza_efectiva?.porcentaje ?? 0}%
                <span>
                  Operatividad · {k.fuerza_efectiva?.activos ?? 0}/
                  {k.fuerza_efectiva?.total ?? 0}
                </span>
              </p>
              <p className="dz-trend flat">Postgres · turno de hoy</p>
            </div>
          </article>
        </section>
      )}

      {!loading && !panel && !error && (
        <p className="mod-muted">Sin datos del panel.</p>
      )}

      {tab === "delitos" && <DelitosLocales panel={panel} loading={loading} />}
      {tab === "mapa" && (
        <MapaCalor filters={filters} radar={panel?.radar} loading={loading} />
      )}
      {tab === "ranking" && (
        <RankingDistritos
          ranking={panel?.ranking_eficiencia || []}
          loading={loading}
        />
      )}
    </div>
  );
}
