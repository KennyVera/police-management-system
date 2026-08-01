import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import OrdenFormulario from "./componentes/OrdenFormulario";
import OrdenesLista from "./componentes/OrdenesLista";
import "../../../../shared/styles/ModuloPage.css";

export default function OrdenesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ agentes: [], tipos_orden: [], prioridades: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        supervisorApi.listOrdenes(),
        supervisorApi.despachoMeta(),
      ]);
      setItems(list);
      setMeta(m);
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
          <p className="mod-kicker">Despacho y Tareas Operativas</p>
          <h2>Órdenes Adicionales</h2>
          <p className="mod-desc">
            Asigna tareas específicas: custodia, traslados de evidencia u otros apoyos.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {ok && (
        <p
          className="mod-muted"
          style={{
            background: "#eaf8ef",
            padding: "0.7rem 0.9rem",
            borderRadius: 10,
            color: "#1f7a45",
          }}
        >
          {ok}
        </p>
      )}

      <OrdenFormulario
        meta={meta}
        onCreated={() => {
          setOk("Orden asignada al agente.");
          load();
        }}
        onError={setError}
      />

      {loading ? (
        <p className="mod-muted">Cargando órdenes...</p>
      ) : (
        <OrdenesLista
          items={items}
          onDecidir={async (id, accion) => {
            try {
              await supervisorApi.decidirOrden(id, { accion });
              load();
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      )}
    </div>
  );
}
