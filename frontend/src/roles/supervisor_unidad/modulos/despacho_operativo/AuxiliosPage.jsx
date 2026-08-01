import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import AuxilioFormulario from "./componentes/AuxilioFormulario";
import AuxiliosLista from "./componentes/AuxiliosLista";
import AsignarAuxilioModal from "./componentes/AsignarAuxilioModal";
import "../../../../shared/styles/ModuloPage.css";

export default function AuxiliosPage() {
  const [pendientes, setPendientes] = useState([]);
  const [activas, setActivas] = useState([]);
  const [meta, setMeta] = useState({ unidades_turno: [], prioridades: [], origenes: [] });
  const [asignar, setAsignar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [pend, act, m] = await Promise.all([
        supervisorApi.listAlertas({ estado: "pendientes" }),
        supervisorApi.listAlertas({ estado: "activas" }),
        supervisorApi.despachoMeta(),
      ]);
      setPendientes(pend);
      setActivas(act);
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
          <h2>Asignación de Auxilios</h2>
          <p className="mod-desc">
            Recibe alertas ECU-911 / central ciudadana y asígnalas al patrullero más cercano.
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

      <AuxilioFormulario
        meta={meta}
        onCreated={() => {
          setOk("Alerta registrada en bandeja pendiente.");
          load();
        }}
        onError={setError}
      />

      {loading ? (
        <p className="mod-muted">Cargando despacho...</p>
      ) : (
        <>
          <AuxiliosLista
            title="Pendientes de asignación"
            items={pendientes}
            empty="No hay auxilios pendientes."
            onAsignar={setAsignar}
          />
          <AuxiliosLista
            title="En curso / asignadas"
            items={activas}
            empty="No hay auxilios activos."
          />
        </>
      )}

      {asignar && (
        <AsignarAuxilioModal
          alerta={asignar}
          unidades={meta.unidades_turno || []}
          onClose={() => setAsignar(null)}
          onAssigned={(msg) => {
            setAsignar(null);
            setOk(msg || "Auxilio asignado.");
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}
