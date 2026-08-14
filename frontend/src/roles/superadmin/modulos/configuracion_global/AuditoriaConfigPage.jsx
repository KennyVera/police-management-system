import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { configApi } from "./api";
import ConfigHeader from "./componentes/ConfigHeader";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

function fmt(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-EC");
  } catch {
    return v;
  }
}

export default function AuditoriaConfigPage() {
  const [items, setItems] = useState([]);
  const [seccion, setSeccion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await configApi.auditoria(seccion || undefined);
      setItems(data.eventos || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [seccion]);

  return (
    <div className="mod-page">
      <ConfigHeader
        title="Auditoría de configuración"
        desc="Cambios con usuario, fecha, valor anterior y valor nuevo."
      >
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" /> Actualizar
        </button>
      </ConfigHeader>

      <section className="cfg-form" style={{ marginBottom: "1rem" }}>
        <label>
          Sección
          <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="">Todas</option>
            {["identidad", "apariencia", "regional", "comunicaciones", "plataforma"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>
        </label>
      </section>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando…</p>
      ) : (
        <section className="panel-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Sección</th>
                <th>Campo</th>
                <th>Anterior</th>
                <th>Nuevo</th>
              </tr>
            </thead>
            <tbody>
              {!items.length && (
                <tr>
                  <td colSpan={6} className="mod-muted">
                    Sin cambios registrados.
                  </td>
                </tr>
              )}
              {items.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.creado_en)}</td>
                  <td className="mod-muted">{e.actor_email || "—"}</td>
                  <td>{e.seccion}</td>
                  <td>{e.campo}</td>
                  <td className="mod-muted">{(e.valor_anterior || "—").slice(0, 80)}</td>
                  <td>{(e.valor_nuevo || "—").slice(0, 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
