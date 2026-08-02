import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import StatsKpis from "./componentes/StatsKpis";
import "../../../../shared/styles/ModuloPage.css";
import "./MonitoreoTactico.css";

export default function EstadisticasPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setStats(await supervisorApi.monitoreoStats());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const prioridades = stats?.auxilios?.por_prioridad || [];

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Monitoreo Táctico Local</p>
          <h2>Estadísticas de la Unidad</h2>
          <p className="mod-desc">
            Auxilios del día, tiempo de respuesta promedio y novedades generadas por el
            circuito.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando estadísticas...</p>
      ) : (
        <>
          <StatsKpis stats={stats} />

          <div className="panel-card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Auxilios por prioridad ({stats?.fecha})</h3>
            {!prioridades.length ? (
              <p className="mod-muted">Sin auxilios registrados hoy.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prioridad</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {prioridades.map((p) => (
                    <tr key={p.prioridad}>
                      <td>{p.prioridad}</td>
                      <td>{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel-card">
            <h3 style={{ marginTop: 0 }}>Detalle operativo</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.7 }}>
              <li>
                Auxilios asignados hoy: <strong>{stats?.auxilios?.asignados_hoy ?? 0}</strong>
              </li>
              <li>
                Atendidos (en lugar / cerrados):{" "}
                <strong>{stats?.auxilios?.atendidos ?? 0}</strong>
              </li>
              <li>
                Cerrados: <strong>{stats?.auxilios?.cerrados ?? 0}</strong>
              </li>
              <li>
                Tiempo promedio de respuesta:{" "}
                <strong>
                  {stats?.tiempos?.promedio_minutos != null
                    ? `${stats.tiempos.promedio_minutos} minutos`
                    : "Sin datos"}
                </strong>
              </li>
              <li>
                Novedades generadas: <strong>{stats?.novedades_hoy ?? 0}</strong>
              </li>
              <li>
                Partes de aprehensión: <strong>{stats?.partes_hoy ?? 0}</strong>
              </li>
              <li>
                Órdenes adicionales: <strong>{stats?.ordenes_hoy ?? 0}</strong>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
