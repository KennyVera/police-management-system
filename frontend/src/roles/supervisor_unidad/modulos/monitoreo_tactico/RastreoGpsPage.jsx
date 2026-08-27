import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import MonitoreoMapa from "./componentes/MonitoreoMapa";
import UnidadesLista from "./componentes/UnidadesLista";
import StatsKpis from "./componentes/StatsKpis";
import "../../../../shared/styles/ModuloPage.css";
import "./MonitoreoTactico.css";

export default function RastreoGpsPage() {
  const [data, setData] = useState({ unidades: [], con_gps: 0 });
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [focusToken, setFocusToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [u, s] = await Promise.all([
        supervisorApi.monitoreoUnidades(),
        supervisorApi.monitoreoStats(),
      ]);
      setData(u);
      setStats(s);
      setSelected((prev) => {
        if (!prev) return prev;
        return (u.unidades || []).find((x) => x.id === prev.id) || prev;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => {
      setTick((t) => t + 1);
      load(true);
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectUnidad(unidad) {
    setSelected(unidad);
    setFocusToken((t) => t + 1);
  }

  const sinGps =
    selected && (selected.latitud == null || selected.longitud == null);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Monitoreo Táctico Local</p>
          <h2>Rastreo GPS de Unidades</h2>
          <p className="mod-desc">
            Ubicación en tiempo real de patrulleros y agentes para coordinar cierres y
            despliegues. Haz clic en una unidad para centrarla en el mapa.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
          <span className="monitoreo-live">
            <span className="pulse" />
            En vivo · {data.con_gps || 0} con GPS
          </span>
          <button type="button" className="btn-ghost" onClick={() => load()}>
            <MaterialIcon name="refresh" />
            Actualizar
          </button>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {stats && <StatsKpis stats={stats} />}

      {loading ? (
        <p className="mod-muted">Cargando monitoreo...</p>
      ) : (
        <>
          {sinGps && (
            <p className="monitoreo-sin-gps">
              <MaterialIcon name="location_off" />
              <span>
                <strong>{selected.unidad_label || "Unidad"}</strong> no tiene GPS en este
                momento. Sector: {selected.sector_detalle || selected.cuadrante || "—"}
              </span>
            </p>
          )}
          <div className="monitoreo-layout">
            <MonitoreoMapa
              unidades={data.unidades || []}
              zonaMapa={data.zona_mapa}
              focus={selected}
              focusToken={focusToken}
            />
            <aside className="panel-card monitoreo-side">
              <h3 style={{ margin: 0 }}>Unidades en turno</h3>
              <UnidadesLista
                unidades={data.unidades || []}
                selectedId={selected?.id}
                onSelect={handleSelectUnidad}
              />
            </aside>
          </div>
        </>
      )}
      <p className="mod-muted" style={{ fontSize: "0.8rem" }}>
        Actualización automática cada 15 s{tick > 0 ? ` · ciclo ${tick}` : ""}.
      </p>
    </div>
  );
}
