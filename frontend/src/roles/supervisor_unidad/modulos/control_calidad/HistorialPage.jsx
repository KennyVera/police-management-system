import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import PartesHistorialLista from "./componentes/PartesHistorialLista";
import "../../../../shared/styles/ModuloPage.css";

export default function HistorialPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await supervisorApi.listHistorial());
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
          <p className="mod-kicker">Control de Calidad</p>
          <h2>Historial de Partes</h2>
          <p className="mod-desc">
            Partes ya aprobados (inmutables) o rechazados con observación al agente.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando historial...</p>
      ) : (
        <div className="panel-card" style={{ overflowX: "auto" }}>
          <PartesHistorialLista items={items} />
        </div>
      )}
    </div>
  );
}
