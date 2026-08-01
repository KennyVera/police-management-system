import { useState } from "react";
import { supervisorApi } from "../../../api";

export default function AsignarVehiculoModal({ escuadra, vehiculos, onClose, onSaved }) {
  const [vehiculo, setVehiculo] = useState(escuadra.vehiculo ? String(escuadra.vehiculo) : "");
  const [turnoInicio, setTurnoInicio] = useState("07:00");
  const [turnoFin, setTurnoFin] = useState("19:00");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!vehiculo) {
      setError("Selecciona un vehículo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await supervisorApi.asignarVehiculoEscuadra(escuadra.id, {
        vehiculo: Number(vehiculo),
        turno_inicio: turnoInicio,
        turno_fin: turnoFin,
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
        <h3>Asignar vehículo</h3>
        <p className="mod-muted" style={{ marginTop: 0 }}>
          Escuadra <strong>{escuadra.nombre}</strong> · Líder{" "}
          {escuadra.agente_lider_info?.nombre || "—"}
        </p>
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label className="full">
            Vehículo
            <select
              required
              value={vehiculo}
              onChange={(e) => setVehiculo(e.target.value)}
            >
              <option value="">Seleccione...</option>
              {(vehiculos || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.tipo_label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inicio turno
            <input
              type="time"
              value={turnoInicio}
              onChange={(e) => setTurnoInicio(e.target.value)}
            />
          </label>
          <label>
            Fin turno
            <input type="time" value={turnoFin} onChange={(e) => setTurnoFin(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : "Asignar vehículo"}
          </button>
        </div>
      </form>
    </div>
  );
}
