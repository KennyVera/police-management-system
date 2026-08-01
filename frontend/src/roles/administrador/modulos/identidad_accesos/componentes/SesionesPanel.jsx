import { useEffect, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { identidadApi } from "../../../api";

export default function SesionesPanel() {
  const [sesiones, setSesiones] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setSesiones(await identidadApi.listSesiones());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  async function cerrar(sessionId) {
    await identidadApi.cerrarSesion(sessionId);
    load();
  }

  if (loading) return <p className="mod-muted">Cargando sesiones...</p>;
  if (error) return <p className="mod-error">{error}</p>;

  return (
    <div className="panel-card">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <strong>Usuarios conectados</strong>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>IP</th>
            <th>Última actividad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sesiones.length === 0 && (
            <tr>
              <td colSpan={4}>No hay sesiones activas.</td>
            </tr>
          )}
          {sesiones.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.user_name}</strong>
                <div className="mod-muted">{s.user_email}</div>
              </td>
              <td>{s.ip_address || "—"}</td>
              <td>{new Date(s.last_seen).toLocaleString()}</td>
              <td>
                <button type="button" className="btn-danger" onClick={() => cerrar(s.id)}>
                  Forzar cierre
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
