import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { saasApi } from "../../../../saas/api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

function money(v) {
  return Number(v || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("es-EC");
  } catch {
    return v;
  }
}

export default function SuscripcionesPage() {
  const [items, setItems] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [nota, setNota] = useState("");
  const [planId, setPlanId] = useState("");
  const [meses, setMeses] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await saasApi.adminSuscripciones(filtro || undefined);
      setItems(data.suscripciones || []);
      setPlanes((data.planes || []).filter((p) => p.activo && !p.archivado));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filtro]);

  function openAction(tipo, row) {
    setNota("");
    setMeses(1);
    setPlanId(row.plan_actual ? String(row.plan_actual) : "");
    setActionModal({ tipo, row });
  }

  async function confirmAction() {
    if (!actionModal) return;
    const { tipo, row } = actionModal;
    setBusyId(row.id);
    setError("");
    try {
      const body = {
        institucion_id: row.id,
        nota: nota.trim(),
      };
      if (tipo === "asignar" || tipo === "cambiar") {
        if (!planId) throw new Error("Selecciona un plan.");
        body.plan_id = Number(planId);
      }
      if (tipo === "renovar") body.meses = Number(meses) || 1;

      const map = {
        asignar: saasApi.adminSuscripcionAsignar,
        cambiar: saasApi.adminSuscripcionCambiar,
        renovar: saasApi.adminSuscripcionRenovar,
        suspender: saasApi.adminSuscripcionSuspender,
        cancelar: saasApi.adminSuscripcionCancelar,
      };
      await map[tipo](body);
      setActionModal(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function verHistorial(row) {
    setBusyId(row.id);
    setError("");
    try {
      setHistorial(await saasApi.adminSuscripcionHistorial(row.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const titles = {
    asignar: "Asignar plan",
    cambiar: "Cambiar plan",
    renovar: "Renovar suscripción",
    suspender: "Suspender suscripción",
    cancelar: "Cancelar suscripción",
  };

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Planes y suscripciones</p>
          <h2>Suscripciones</h2>
          <p className="mod-desc">
            Asignar, cambiar, renovar, suspender o cancelar planes por institución.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "0.55rem 0.75rem",
              font: "inherit",
            }}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="PRUEBA">Prueba</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <button type="button" className="btn-ghost" onClick={load}>
            <MaterialIcon name="refresh" />
            Actualizar
          </button>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando suscripciones…</p>
      ) : (
        <section className="panel-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Renovación</th>
                <th>Usuarios</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="mod-muted">
                    No hay suscripciones para mostrar.
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.nombre_comercial}</strong>
                    <div className="mod-muted">{s.ruc}</div>
                    {s.admin_email && (
                      <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
                        {s.admin_email}
                      </div>
                    )}
                  </td>
                  <td>
                    {s.plan_nombre}
                    <div className="mod-muted">{money(s.precio_mensual)}/mes</div>
                  </td>
                  <td>
                    <span
                      className={`pill ${
                        s.estado_pago === "SUSPENDIDO" ||
                        s.estado_pago === "CANCELADO"
                          ? "bad"
                          : "ok"
                      }`}
                    >
                      {s.estado_pago_label || s.estado_pago}
                    </span>
                  </td>
                  <td>{fmtDate(s.fecha_renovacion)}</td>
                  <td>{s.usuarios_count}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id}
                        title="Asignar plan"
                        onClick={() => openAction("asignar", s)}
                      >
                        <MaterialIcon name="add_card" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id || !s.plan_actual}
                        title="Cambiar plan"
                        onClick={() => openAction("cambiar", s)}
                      >
                        <MaterialIcon name="swap_horiz" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id}
                        title="Renovar"
                        onClick={() => openAction("renovar", s)}
                      >
                        <MaterialIcon name="autorenew" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id}
                        title="Suspender"
                        onClick={() => openAction("suspender", s)}
                      >
                        <MaterialIcon name="pause_circle" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id}
                        title="Cancelar"
                        onClick={() => openAction("cancelar", s)}
                      >
                        <MaterialIcon name="cancel" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === s.id}
                        title="Ver historial"
                        onClick={() => verHistorial(s)}
                      >
                        <MaterialIcon name="history" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{titles[actionModal.tipo]}</h3>
            <p className="mod-muted" style={{ marginTop: 0 }}>
              {actionModal.row.nombre_comercial}
            </p>
            {(actionModal.tipo === "asignar" || actionModal.tipo === "cambiar") && (
              <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                Plan
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  required
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "0.55rem 0.75rem",
                    font: "inherit",
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {money(p.precio_mensual)}/mes
                    </option>
                  ))}
                </select>
              </label>
            )}
            {actionModal.tipo === "renovar" && (
              <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                Meses a renovar
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={meses}
                  onChange={(e) => setMeses(e.target.value)}
                />
              </label>
            )}
            <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              Nota (opcional)
              <textarea
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Motivo o referencia interna"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setActionModal(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={
                  actionModal.tipo === "cancelar" || actionModal.tipo === "suspender"
                    ? "btn-danger"
                    : "btn-accent"
                }
                disabled={busyId === actionModal.row.id}
                onClick={confirmAction}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {historial && (
        <div className="modal-backdrop" onClick={() => setHistorial(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 720, maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Historial · {historial.institucion?.nombre_comercial}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {(historial.historial || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="mod-muted">
                      Sin eventos registrados.
                    </td>
                  </tr>
                )}
                {(historial.historial || []).map((ev) => (
                  <tr key={ev.id}>
                    <td>{fmtDate(ev.creado_en)}</td>
                    <td>{ev.accion_label || ev.accion}</td>
                    <td>
                      {ev.plan_anterior_nombre || "—"}
                      {" → "}
                      {ev.plan_nuevo_nombre || "—"}
                    </td>
                    <td>
                      {ev.estado_anterior || "—"} → {ev.estado_nuevo || "—"}
                    </td>
                    <td className="mod-muted">{ev.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setHistorial(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
