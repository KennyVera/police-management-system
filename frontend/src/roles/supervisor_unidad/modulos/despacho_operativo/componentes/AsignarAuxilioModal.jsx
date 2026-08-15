import { useEffect, useState } from "react";
import { supervisorApi } from "../../../api";

export default function AsignarAuxilioModal({ alerta, unidades, onClose, onAssigned, onError }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [escuadra, setEscuadra] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supervisorApi
      .sugerenciasAlerta(alerta.id)
      .then((d) => {
        const list = d.sugerencias || [];
        setSugerencias(list);
        if (list[0]?.escuadra_id) setEscuadra(String(list[0].escuadra_id));
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
      const nombre =
        res.escuadra_info?.nombre || res.escuadra_nombre || res.agente_info?.nombre || "escuadra";
      onAssigned(`Asignado a ${nombre}${dist}`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function asignarManual(e) {
    e.preventDefault();
    if (!escuadra) return;
    setBusy(true);
    onError("");
    try {
      const res = await supervisorApi.asignarAlerta(alerta.id, {
        escuadra: Number(escuadra),
      });
      const nombre =
        res.escuadra_info?.nombre || res.escuadra_nombre || "escuadra";
      onAssigned(`Asignado a ${nombre}`);
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
          <p className="mod-muted">Calculando escuadras cercanas...</p>
        ) : (
          <div className="form-grid">
            <label className="full">
              Escuadra
              <select
                required
                value={escuadra}
                onChange={(e) => setEscuadra(e.target.value)}
              >
                <option value="">Seleccione escuadra...</option>
                {pool.map((u) => (
                  <option key={u.escuadra_id} value={u.escuadra_id}>
                    {u.escuadra_nombre}
                    {u.lider?.nombre ? ` · Líder: ${u.lider.nombre}` : ""}
                    {u.miembros != null ? ` · ${u.miembros} int.` : ""}
                    {u.vehiculo_placa ? ` · ${u.vehiculo_placa}` : ""}
                    {u.distancia_km != null ? ` · ${u.distancia_km} km` : ""}
                  </option>
                ))}
              </select>
            </label>
            {!pool.length && (
              <p className="full mod-muted" style={{ margin: 0 }}>
                No hay escuadras disponibles. Las que están en turno ya tienen un
                auxilio activo, o no hay escuadras creadas para hoy.
              </p>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-ghost" disabled={busy || !pool.length} onClick={asignarAuto}>
            Más cercana
          </button>
          <button type="submit" className="btn-accent" disabled={busy || !escuadra}>
            Asignar
          </button>
        </div>
      </form>
    </div>
  );
}
