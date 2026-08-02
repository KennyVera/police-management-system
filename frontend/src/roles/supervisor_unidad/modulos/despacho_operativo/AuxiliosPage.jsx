import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import AuxilioFormulario from "./componentes/AuxilioFormulario";
import AuxilioMapaSelector from "./componentes/AuxilioMapaSelector";
import AuxiliosLista from "./componentes/AuxiliosLista";
import AsignarAuxilioModal from "./componentes/AsignarAuxilioModal";
import "../../../../shared/styles/ModuloPage.css";
import "./componentes/AuxilioRegistro.css";

const FORM_DEFAULT = {
  titulo: "",
  descripcion: "",
  direccion: "",
  referencia: "",
  origen: "ECU-911",
  prioridad: "ALTA",
  latitud: "-0.1807",
  longitud: "-78.4678",
};

export default function AuxiliosPage() {
  const [pendientes, setPendientes] = useState([]);
  const [activas, setActivas] = useState([]);
  const [meta, setMeta] = useState({ unidades_turno: [], prioridades: [], origenes: [] });
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await supervisorApi.createAlerta({
        ...form,
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
      });
      setForm(FORM_DEFAULT);
      setOk("Alerta registrada en bandeja pendiente.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

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

      <section className="panel-card auxilio-registro">
        <AuxilioFormulario
          meta={meta}
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={handleSubmit}
        />
        <AuxilioMapaSelector
          latitud={form.latitud}
          longitud={form.longitud}
          onLocationSelect={({ latitud, longitud, direccion, referencia }) => {
            setForm((prev) => ({
              ...prev,
              latitud,
              longitud,
              direccion: direccion || prev.direccion,
              referencia: referencia || "",
            }));
          }}
        />
      </section>

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
