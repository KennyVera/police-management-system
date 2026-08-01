import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../../api";

export default function OrdenFormulario({ meta, onCreated, onError }) {
  const [form, setForm] = useState({
    agente: "",
    tipo: "CUSTODIA",
    titulo: "",
    detalle: "",
    lugar: "",
    prioridad: "MEDIA",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      await supervisorApi.createOrden({
        ...form,
        agente: Number(form.agente),
      });
      setForm({
        agente: "",
        tipo: "CUSTODIA",
        titulo: "",
        detalle: "",
        lugar: "",
        prioridad: "MEDIA",
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
        Nueva orden adicional
      </h3>
      <label>
        Agente
        <select
          required
          value={form.agente}
          onChange={(e) => setForm({ ...form, agente: e.target.value })}
        >
          <option value="">Seleccione...</option>
          {(meta.agentes || []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tipo
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
        >
          {(meta.tipos_orden || []).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
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
        Título
        <input
          required
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          placeholder="Custodia en Hospital Eugenio Espejo"
        />
      </label>
      <label className="full">
        Lugar
        <input
          value={form.lugar}
          onChange={(e) => setForm({ ...form, lugar: e.target.value })}
        />
      </label>
      <label className="full">
        Detalle
        <textarea
          required
          rows={2}
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
        />
      </label>
      <div className="full">
        <button type="submit" className="btn-accent" disabled={saving}>
          <MaterialIcon name="assignment_add" />
          {saving ? "Asignando..." : "Asignar orden"}
        </button>
      </div>
    </form>
  );
}
