import { useState } from "react";
import { supervisorApi } from "../../../api";

export default function VehiculoEditModal({ vehiculo, tipos, onClose, onSaved }) {
  const [form, setForm] = useState({
    placa: vehiculo.placa || "",
    tipo: vehiculo.tipo || "AUTOMOVIL",
    descripcion: vehiculo.descripcion || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await supervisorApi.updateVehiculo(vehiculo.id, {
        placa: form.placa.trim().toUpperCase(),
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
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
      <form className="modal-card flota-tipo-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Editar vehículo</h3>
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label>
            Placa
            <input
              required
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Tipo
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {tipos.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Descripción
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
