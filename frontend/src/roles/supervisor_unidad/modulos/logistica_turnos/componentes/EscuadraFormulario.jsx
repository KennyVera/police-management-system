import { useMemo, useState } from "react";
import { supervisorApi } from "../../../api";

export default function EscuadraFormulario({ agentes, fechaDefault, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: "",
    fecha: fechaDefault,
    agente_lider: "",
    companeros: [],
    observaciones: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const companerosDisponibles = useMemo(
    () => agentes.filter((a) => String(a.id) !== String(form.agente_lider)),
    [agentes, form.agente_lider]
  );

  function toggleCompanero(id) {
    const sid = String(id);
    setForm((prev) => {
      const has = prev.companeros.includes(sid);
      return {
        ...prev,
        companeros: has
          ? prev.companeros.filter((x) => x !== sid)
          : [...prev.companeros, sid],
      };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const lider = Number(form.agente_lider);
      const companeros = form.companeros.map(Number).filter((id) => id !== lider);
      await supervisorApi.createEscuadra({
        nombre: form.nombre,
        fecha: form.fecha,
        agente_lider: lider,
        companeros,
        observaciones: form.observaciones,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Nueva escuadra</h3>
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label className="full">
            Nombre
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Escuadra Alpha"
            />
          </label>
          <label>
            Fecha
            <input
              type="date"
              required
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </label>
          <label>
            Agente líder
            <select
              required
              value={form.agente_lider}
              onChange={(e) => {
                const lider = e.target.value;
                setForm({
                  ...form,
                  agente_lider: lider,
                  companeros: form.companeros.filter((id) => id !== lider),
                });
              }}
            >
              <option value="">Seleccione...</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="full">
            <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>
              Compañeros ({form.companeros.length})
            </p>
            <p className="mod-muted" style={{ margin: "0 0 0.6rem", fontSize: "0.85rem" }}>
              Puedes marcar varios agentes. El líder no aparece en esta lista.
            </p>
            <div
              style={{
                border: "1px solid #e5e9f2",
                borderRadius: 10,
                padding: "0.65rem 0.75rem",
                maxHeight: 180,
                overflowY: "auto",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              {!form.agente_lider ? (
                <p className="mod-muted" style={{ margin: 0 }}>
                  Primero elige el agente líder.
                </p>
              ) : !companerosDisponibles.length ? (
                <p className="mod-muted" style={{ margin: 0 }}>
                  No hay más agentes disponibles.
                </p>
              ) : (
                companerosDisponibles.map((a) => (
                  <label
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.companeros.includes(String(a.id))}
                      onChange={() => toggleCompanero(a.id)}
                    />
                    {a.nombre}
                  </label>
                ))
              )}
            </div>
          </div>
          <label className="full">
            Observaciones
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              style={{
                border: "1px solid #e5e9f2",
                borderRadius: 10,
                padding: "0.6rem",
                font: "inherit",
              }}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : "Crear escuadra"}
          </button>
        </div>
      </form>
    </div>
  );
}
