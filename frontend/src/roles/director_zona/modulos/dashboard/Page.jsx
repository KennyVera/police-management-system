import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import { btnGhost, btnPrimary, glassCard, kpiCard } from "../../../../shared/ui/saas";
import "../../../../shared/styles/ModuloPage.css";
import "./Dashboard.css";
import DelitosLocales from "./DelitosLocales/Page";
import MapaCalor from "./MapaCalor/Page";
import RankingDistritos from "./RankingDistritos/Page";
import EstadoPartes from "./EstadoPartes/Page";

function defaultRange() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - 30);
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [mapaData, setMapaData] = useState(null);
  const panelRef = useRef(null);
  const exportingRef = useRef(false);
  const onMapaChange = useCallback((data) => setMapaData(data), []);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);

  const load = useCallback(async (active = filters) => {
    if (exportingRef.current) return;
    setLoading(true);
    setError("");
    try {
      const data = await directorApi.panel(active);
      setPanel(data);
      setError("");
    } catch (err) {
      const msg = err.message || "No se pudo cargar el panel táctico";
      if (panelRef.current) {
        setError(`No se pudo actualizar (se mantienen los datos en pantalla): ${msg}`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  function aplicar(e) {
    e?.preventDefault?.();
    if (exporting) return;
    setFilters({ ...draft });
  }

  function limpiar() {
    if (exporting) return;
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

  async function exportarPdf() {
    if (!panel) {
      setExportError("Espere a que cargue el dashboard antes de exportar.");
      return;
    }
    if (tab === "mapa" && !mapaData) {
      setExportError("Espere a que cargue el mapa de calor antes de exportar.");
      return;
    }
    setExporting(true);
    exportingRef.current = true;
    setExportError("");
    try {
      if (tab === "mapa") {
        await directorApi.descargarDashboardPdf(filters, panel, {
          vista: "mapa",
          mapa: mapaData,
          radar: panel.radar,
        });
      } else if (tab === "ranking") {
        await directorApi.descargarDashboardPdf(filters, panel, {
          vista: "ranking",
          ranking: panel.ranking_eficiencia || [],
        });
      } else if (tab === "estado") {
        await directorApi.descargarDashboardPdf(filters, panel, {
          vista: "estado",
          estado_partes: panel.estado_partes || null,
        });
      } else {
        await directorApi.descargarDashboardPdf(filters, panel, { vista: "delitos" });
      }
    } catch (err) {
      setExportError(err.message || "No se pudo exportar el PDF del dashboard");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
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
        <div className="dz-head-actions">
          <button
            type="button"
            className={`${btnPrimary} dz-btn-export`}
            onClick={exportarPdf}
            disabled={
              loading ||
              exporting ||
              !panel ||
              (tab === "mapa" && !mapaData)
            }
            title={
              tab === "mapa"
                ? "Exportar Mapa de Calor a PDF"
                : tab === "ranking"
                  ? "Exportar Ranking Distritos a PDF"
                  : tab === "estado"
                    ? "Exportar Estado de Partes a PDF"
                    : "Exportar dashboard (Delitos Locales) a PDF"
            }
          >
            <MaterialIcon name="picture_as_pdf" />
            {exporting
              ? "Generando…"
              : tab === "mapa"
                ? "Exportar PDF (Mapa)"
                : tab === "ranking"
                  ? "Exportar PDF (Ranking)"
                  : tab === "estado"
                    ? "Exportar PDF (Estado)"
                    : "Exportar PDF"}
          </button>
          <button
            type="button"
            className={`${btnGhost} dz-refresh`}
            onClick={() => load()}
            disabled={loading || exporting}
          >
            <MaterialIcon name="refresh" />
            Actualizar
            {panel?.actualizado_en && <small>· Hoy, {panel.actualizado_en}</small>}
          </button>
        </div>
      </header>

      {exportError && <p className="dz-export-error">{exportError}</p>}

      <form
        className={`${glassCard} dz-filters grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6`}
        onSubmit={aplicar}
      >
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
        <button type="submit" className={`${btnPrimary} dz-btn-primary sm:col-span-1`}>
          <MaterialIcon name="filter_alt" />
          Aplicar filtros
        </button>
        <button type="button" className={`${btnGhost} dz-btn-ghost`} onClick={limpiar}>
          Limpiar filtros
        </button>
      </form>

      <div className="dz-tabs">
        {[
          { id: "delitos", label: "Delitos Locales", icon: "monitoring" },
          { id: "mapa", label: "Mapa de Calor", icon: "map" },
          { id: "ranking", label: "Ranking Distritos", icon: "leaderboard" },
          { id: "estado", label: "Estado de Partes", icon: "task_alt" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${
              tab === t.id ? "active" : ""
            } transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
            onClick={() => setTab(t.id)}
          >
            <MaterialIcon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="dz-error">{error}</p>}

      {k && (
        <section className="dz-kpi-row grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <article className={`dz-kpi tone-purple ${kpiCard}`}>
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

          <article className={`dz-kpi tone-green ${kpiCard}`}>
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

          <article className={`dz-kpi tone-orange ${kpiCard}`}>
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

          <article className={`dz-kpi tone-red ${kpiCard}`}>
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

          <article className={`dz-kpi tone-blue ${kpiCard}`}>
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
        <MapaCalor
          filters={filters}
          radar={panel?.radar}
          loading={loading}
          onMapaChange={onMapaChange}
        />
      )}
      {tab === "ranking" && (
        <RankingDistritos
          ranking={panel?.ranking_eficiencia || []}
          loading={loading}
        />
      )}
      {tab === "estado" && (
        <EstadoPartes data={panel?.estado_partes} loading={loading} />
      )}
    </div>
  );
}
