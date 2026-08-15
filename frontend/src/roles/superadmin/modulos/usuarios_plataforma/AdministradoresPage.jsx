import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { saasApi } from "../../../../saas/api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

function fmt(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-EC");
  } catch {
    return v;
  }
}

export default function AdministradoresPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [edit, setEdit] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [password, setPassword] = useState("");
  const [actividad, setActividad] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (estado) params.estado = estado;
      const data = await saasApi.adminAdmins(params);
      setItems(data.administradores || []);
      setInstituciones(data.instituciones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [estado]);

  async function saveEdit(e) {
    e.preventDefault();
    setBusyId(edit.id);
    setError("");
    try {
      await saasApi.adminAdminEditar(edit.id, {
        first_name: edit.first_name,
        last_name: edit.last_name,
        email: edit.email,
        telefono: edit.telefono,
        institucion_id: edit.institucion_id || null,
        two_factor_enabled: edit.two_factor_enabled,
        marcar_admin_institucional: edit.marcar_admin_institucional,
      });
      setEdit(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function setEstadoAdmin(row, nuevo) {
    setBusyId(row.id);
    setError("");
    try {
      await saasApi.adminAdminEstado(row.id, { estado: nuevo });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function restablecer(e) {
    e.preventDefault();
    setBusyId(resetModal.id);
    setError("");
    try {
      await saasApi.adminAdminRestablecer(resetModal.id, {
        new_password: password,
        reactivar: true,
      });
      setResetModal(null);
      setPassword("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function revocar(row) {
    const ok = await confirm({
      title: "Revocar acceso",
      message: `¿Revocar acceso de ${row.nombre}? Quedará en baja.`,
      confirmLabel: "Revocar",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(row.id);
    setError("");
    try {
      await saasApi.adminAdminRevocar(row.id, { nota: "Revocado desde SuperAdmin" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function verActividad(row) {
    setBusyId(row.id);
    setError("");
    try {
      setActividad(await saasApi.adminAdminActividad(row.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Usuarios de plataforma</p>
          <h2>Administradores institucionales</h2>
          <p className="mod-desc">
            Administrar administradores de cada institución: acceso, datos y auditoría.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Buscar nombre, correo, institución…"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "0.55rem 0.75rem",
              minWidth: 220,
              font: "inherit",
            }}
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "0.55rem 0.75rem",
              font: "inherit",
            }}
          >
            <option value="">Todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="BAJA">Baja</option>
          </select>
          <button type="button" className="btn-ghost" onClick={load}>
            <MaterialIcon name="refresh" />
            Actualizar
          </button>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando administradores…</p>
      ) : (
        <section className="panel-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Administrador</th>
                <th>Institución</th>
                <th>Estado</th>
                <th>Sesiones</th>
                <th>Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="mod-muted">
                    No hay administradores institucionales.
                  </td>
                </tr>
              )}
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.nombre}</strong>
                    <div className="mod-muted">{a.email}</div>
                    {a.es_admin_institucional && (
                      <span className="pill ok" style={{ marginTop: 4 }}>
                        Master Admin
                      </span>
                    )}
                  </td>
                  <td>
                    {a.institucion_nombre}
                    {a.institucion_ruc && (
                      <div className="mod-muted">{a.institucion_ruc}</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`pill ${
                        a.estado === "ACTIVO" ? "ok" : "bad"
                      }`}
                    >
                      {a.estado_label || a.estado}
                    </span>
                  </td>
                  <td>{a.sesiones_activas}</td>
                  <td>{fmt(a.ultima_sesion)}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        title="Editar"
                        disabled={busyId === a.id}
                        onClick={() =>
                          setEdit({
                            ...a,
                            marcar_admin_institucional: a.es_admin_institucional,
                          })
                        }
                      >
                        <MaterialIcon name="edit" />
                      </button>
                      {a.estado === "ACTIVO" ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          title="Desactivar"
                          disabled={busyId === a.id}
                          onClick={() => setEstadoAdmin(a, "SUSPENDIDO")}
                        >
                          <MaterialIcon name="toggle_on" />
                        </button>
                      ) : a.estado !== "BAJA" ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          title="Activar"
                          disabled={busyId === a.id}
                          onClick={() => setEstadoAdmin(a, "ACTIVO")}
                        >
                          <MaterialIcon name="toggle_off" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost"
                        title="Restablecer acceso"
                        disabled={busyId === a.id}
                        onClick={() => {
                          setPassword("");
                          setResetModal(a);
                        }}
                      >
                        <MaterialIcon name="lock_reset" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        title="Revocar acceso"
                        disabled={busyId === a.id || a.estado === "BAJA"}
                        onClick={() => revocar(a)}
                      >
                        <MaterialIcon name="person_off" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        title="Actividad / auditoría"
                        disabled={busyId === a.id}
                        onClick={() => verActividad(a)}
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

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <form
            className="modal-card"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEdit}
          >
            <h3>Editar administrador</h3>
            <div className="form-grid">
              <label>
                Nombre
                <input
                  value={edit.first_name || ""}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
                />
              </label>
              <label>
                Apellido
                <input
                  value={edit.last_name || ""}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
                />
              </label>
              <label className="full">
                Correo
                <input
                  type="email"
                  required
                  value={edit.email || ""}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </label>
              <label>
                Teléfono
                <input
                  value={edit.telefono || ""}
                  onChange={(e) => setEdit({ ...edit, telefono: e.target.value })}
                />
              </label>
              <label>
                Institución
                <select
                  value={edit.institucion_id || ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      institucion_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Sin institución</option>
                  {instituciones.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre_comercial}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(edit.two_factor_enabled)}
                  onChange={(e) =>
                    setEdit({ ...edit, two_factor_enabled: e.target.checked })
                  }
                />
                2FA habilitado
              </label>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(edit.marcar_admin_institucional)}
                  onChange={(e) =>
                    setEdit({ ...edit, marcar_admin_institucional: e.target.checked })
                  }
                />
                Master Admin de la institución
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-accent" disabled={busyId === edit.id}>
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {resetModal && (
        <div className="modal-backdrop" onClick={() => setResetModal(null)}>
          <form
            className="modal-card"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={restablecer}
          >
            <h3>Restablecer acceso</h3>
            <p className="mod-muted" style={{ marginTop: 0 }}>
              {resetModal.nombre} · {resetModal.email}
            </p>
            <label style={{ display: "grid", gap: 6 }}>
              Nueva contraseña
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setResetModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-accent" disabled={busyId === resetModal.id}>
                Restablecer
              </button>
            </div>
          </form>
        </div>
      )}

      {actividad && (
        <div className="modal-backdrop" onClick={() => setActividad(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 720, maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Auditoría · {actividad.administrador?.nombre}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Actor</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(actividad.eventos || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="mod-muted">
                      Sin eventos.
                    </td>
                  </tr>
                )}
                {(actividad.eventos || []).map((ev) => (
                  <tr key={ev.id}>
                    <td>{fmt(ev.creado_en)}</td>
                    <td>{ev.accion_label || ev.accion}</td>
                    <td className="mod-muted">{ev.actor_email || "—"}</td>
                    <td className="mod-muted">{ev.detalle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setActividad(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
