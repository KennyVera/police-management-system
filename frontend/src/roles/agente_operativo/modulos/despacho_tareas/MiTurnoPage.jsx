import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../api";
import TurnoResumen from "./componentes/TurnoResumen";
import "../../../../shared/styles/ModuloPage.css";
import "./DespachoTareas.css";

export default function MiTurnoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await agenteApi.miTurno());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Despacho y Tareas · Mi Turno</p>
          <h2>Asignación Diaria</h2>
          <p className="mod-desc">
            Compañero de patrulla, vehículo asignado y zona o cuadrante de servicio para
            el día.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando asignación...</p>
      ) : !data?.asignacion ? (
        <div className="panel-card">
          <p className="mod-muted">
            {data?.detail || "No tienes asignación de turno para hoy."}
          </p>
        </div>
      ) : (
        <TurnoResumen asignacion={data.asignacion} fechaConsulta={data.fecha} />
      )}
    </div>
  );
}
