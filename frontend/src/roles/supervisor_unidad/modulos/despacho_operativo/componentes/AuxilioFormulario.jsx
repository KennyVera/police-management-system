import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../../api";

const QUIITO = { lat: "-0.1807", lng: "-78.4678" };

export default function AuxilioFormulario({ meta, onCreated, onError }) {
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    direccion: "",
    referencia: "",
    origen: "ECU-911",
    prioridad: "ALTA",
    latitud: QUIITO.lat,
    longitud: QUIITO.lng,
  });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      await supervisorApi.createAlerta({
        ...form,
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
      });
      setForm({
        titulo: "",
        descripcion: "",
        direccion: "",
        referencia: "",
        origen: "ECU-911",
        prioridad: "ALTA",
        latitud: QUIITO.lat,
        longitud: QUIITO.lng,
      });
      onCreated();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel-card form-grid" onSubmit={submit}>
      <h3 className="full" style={{ margin: 0 }}>
        Registrar alerta entrante
      </h3>
      <label className="full">
        Título
        <input
          required
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Robo en progreso"
        />
      </label>
      <label>
        Origen
        <select
          value={form.origen}
          onChange={(e) => setForm({ ...form, origen: e.target.value })}
        >
          {(meta.origenes || ["ECU-911"]).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prioridad
        <select
          value={form.prioridad}
          onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
        >
          {(meta.prioridades || []).map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="full">
        Dirección
        <input
          required
          value={form.direccion}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
        />
      </label>
      <label className="full">
        Referencia
        <input
          value={form.referencia}
          onChange={(e) => setForm({ ...form, referencia: e.target.value })}
        />
      </label>
      <label className="full">
        Descripción
        <textarea
          rows={2}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
        />
      </label>
      <label>
        Latitud
        <input
          value={form.latitud}
          onChange={(e) => setForm({ ...form, latitud: e.target.value })}
        />
      </label>
      <label>
        Longitud
        <input
          value={form.longitud}
          onChange={(e) => setForm({ ...form, longitud: e.target.value })}
        />
      </label>
      <div className="full">
        <button type="submit" className="btn-accent" disabled={saving}>
          <MaterialIcon name="emergency" />
          {saving ? "Guardando..." : "Ingresar a bandeja"}
        </button>
      </div>
    </form>
  );
}
