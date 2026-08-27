import { useMemo, useState } from "react";
import { supervisorApi } from "../../../api";

export default function AsignarVehiculoModal({
  escuadra = null,
  escuadras = [],
  vehiculos,
  onClose,
  onSaved,
}) {
  const opciones = useMemo(
    () => (escuadra ? [escuadra] : escuadras),
    [escuadra, escuadras]
  );
  const [escuadraId, setEscuadraId] = useState(
    escuadra ? String(escuadra.id) : opciones[0] ? String(opciones[0].id) : ""
  );
  const seleccionada = opciones.find((e) => String(e.id) === String(escuadraId)) || null;
  const [vehiculo, setVehiculo] = useState(
    seleccionada?.vehiculo ? String(seleccionada.vehiculo) : ""
  );
  const [turnoInicio, setTurnoInicio] = useState("07:00");
  const [turnoFin, setTurnoFin] = useState("19:00");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const vehiculosDisponibles = useMemo(() => {
    const ocupados = new Set(
      escuadras
        .filter((e) => e.vehiculo && String(e.id) !== String(escuadraId))
        .map((e) => e.vehiculo)
    );
    return (vehiculos || []).filter((v) => !ocupados.has(v.id));
  }, [vehiculos, escuadras, escuadraId]);

  function onChangeEscuadra(id) {
    setEscuadraId(id);
    const next = opciones.find((e) => String(e.id) === String(id));
    const ocupados = new Set(
      escuadras
        .filter((e) => e.vehiculo && String(e.id) !== String(id))
        .map((e) => e.vehiculo)
    );
    const disp = (vehiculos || []).filter((v) => !ocupados.has(v.id));
    const nextVeh = next?.vehiculo ? String(next.vehiculo) : "";
    setVehiculo(disp.some((v) => String(v.id) === nextVeh) ? nextVeh : "");
  }

  async function submit(e) {
    e.preventDefault();
    if (!seleccionada) {
      setError("Selecciona una escuadra.");
      return;
    }
    if (!vehiculo) {
      setError("Selecciona un vehículo disponible.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await supervisorApi.asignarVehiculoEscuadra(seleccionada.id, {
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
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label className="full">
            Escuadra
            <select
              required
              value={escuadraId}
              onChange={(e) => onChangeEscuadra(e.target.value)}
              disabled={Boolean(escuadra)}
            >
              <option value="">Seleccione escuadra...</option>
              {opciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                  {e.agente_lider_info?.nombre ? ` · ${e.agente_lider_info.nombre}` : ""}
                  {!e.vehiculo ? " · Sin vehículo" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Vehículo
            <select
              required
              value={vehiculo}
              onChange={(e) => setVehiculo(e.target.value)}
            >
              <option value="">Seleccione...</option>
              {vehiculosDisponibles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.tipo_label}
                </option>
              ))}
            </select>
            {!vehiculosDisponibles.length && (
              <small className="mod-muted">No hay vehículos disponibles para esta fecha.</small>
            )}
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
          <button
            type="submit"
            className="btn-accent"
            disabled={saving || !opciones.length || !vehiculosDisponibles.length}
          >
            {saving ? "Guardando..." : "Asignar vehículo"}
          </button>
        </div>
      </form>
    </div>
  );
}
