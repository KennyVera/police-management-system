import { useEffect, useState } from "react";
import { supervisorApi } from "../../../api";

export default function AsignarAuxilioModal({ alerta, unidades, onClose, onAssigned, onError }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [agente, setAgente] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supervisorApi
      .sugerenciasAlerta(alerta.id)
      .then((d) => {
        const list = d.sugerencias || [];
        setSugerencias(list);
        if (list[0]?.agente?.id) setAgente(String(list[0].agente.id));
      })
      .catch((err) => onError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerta.id]);

  const pool = sugerencias.length ? sugerencias : unidades;

  async function asignarAuto() {
    setBusy(true);
    onError("");
    try {
      const res = await supervisorApi.asignarAlerta(alerta.id, { auto_cercano: true });
      const dist = res.distancia_km != null ? ` (~${res.distancia_km} km)` : "";
      onAssigned(`Asignado a ${res.agente_info?.nombre || "unidad"}${dist}`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function asignarManual(e) {
    e.preventDefault();
    if (!agente) return;
    setBusy(true);
    onError("");
    try {
      const res = await supervisorApi.asignarAlerta(alerta.id, { agente: Number(agente) });
      onAssigned(`Asignado a ${res.agente_info?.nombre || "agente"}`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={asignarManual}>
        <h3>Asignar auxilio</h3>
        <p className="mod-muted" style={{ marginTop: 0 }}>
          <strong>{alerta.titulo}</strong> · {alerta.direccion}
        </p>
        {loading ? (
          <p className="mod-muted">Calculando unidades cercanas...</p>
        ) : (
          <div className="form-grid">
            <label className="full">
              Unidad / agente
              <select required value={agente} onChange={(e) => setAgente(e.target.value)}>
                <option value="">Seleccione...</option>
                {pool.map((u) => (
                  <option key={u.agente?.id || u.asignacion_id} value={u.agente?.id}>
                    {u.agente?.nombre}
                    {u.vehiculo_placa ? ` · ${u.vehiculo_placa}` : ""}
                    {u.distancia_km != null ? ` · ${u.distancia_km} km` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={asignarAuto}>
            Más cercano
          </button>
          <button type="submit" className="btn-accent" disabled={busy || !agente}>
            Asignar
          </button>
        </div>
      </form>
    </div>
  );
}
