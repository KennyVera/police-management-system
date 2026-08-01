import { useState } from "react";
import { agenteApi } from "../../../api";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY = {
  fecha_hora: toLocalInput(new Date().toISOString()),
  lugar: "",
  tipo: "OTRO",
  descripcion: "",
  hubo_detenidos: false,
  observaciones: "",
};

export default function NovedadFormulario({ tipos, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          fecha_hora: toLocalInput(initial.fecha_hora),
          lugar: initial.lugar || "",
          tipo: initial.tipo || "OTRO",
          descripcion: initial.descripcion || "",
          hubo_detenidos: Boolean(initial.hubo_detenidos),
          observaciones: initial.observaciones || "",
        }
      : EMPTY
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      fecha_hora: new Date(form.fecha_hora).toISOString(),
    };
    try {
      if (isEdit) await agenteApi.updateNovedad(initial.id, payload);
      else await agenteApi.createNovedad(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEdit ? "Editar novedad" : "Registrar novedad / incidente"}</h3>
        {error && <p className="mod-error">{error}</p>}

        <div className="form-grid">
          <label>
            Fecha y hora
            <input
              type="datetime-local"
              required
              value={form.fecha_hora}
              onChange={(e) => setField("fecha_hora", e.target.value)}
            />
          </label>
          <label>
            Tipo
            <select
              required
              value={form.tipo}
              onChange={(e) => setField("tipo", e.target.value)}
            >
              {tipos.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Lugar
            <input
              required
              value={form.lugar}
              onChange={(e) => setField("lugar", e.target.value)}
            />
          </label>
          <label className="full">
            Descripción
            <textarea
              required
              rows={4}
              value={form.descripcion}
              onChange={(e) => setField("descripcion", e.target.value)}
              style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem 0.7rem", font: "inherit" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={form.hubo_detenidos}
              onChange={(e) => setField("hubo_detenidos", e.target.checked)}
            />
            Hubo detenidos (si aplica, registra también el parte)
          </label>
          <label className="full">
            Observaciones
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem 0.7rem", font: "inherit" }}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : "Guardar novedad"}
          </button>
        </div>
      </form>
    </div>
  );
}
