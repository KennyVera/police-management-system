import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
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

export default function GestionAccesoPage() {
  const [tab, setTab] = useState("sesiones");
  const [sesiones, setSesiones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSesiones() {
    const data = await saasApi.adminAccesoSesiones();
    setSesiones(data.sesiones || []);
  }

  async function loadHistorial() {
    const data = await saasApi.adminAccesoHistorial();
    setHistorial(data.historial || []);
  }

  async function loadAdmins() {
    const data = await saasApi.adminAdmins();
    setAdmins(data.administradores || []);
    setCatalogo(data.permisos_catalogo || []);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (tab === "sesiones") await loadSesiones();
      else if (tab === "historial") await loadHistorial();
      else await loadAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    if (tab !== "permisos" || !selectedAdmin) return;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const data = await saasApi.adminAdminPermisos(selectedAdmin);
        setPermisos(data.permisos || []);
        if (data.catalogo?.length) setCatalogo(data.catalogo);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    })();
  }, [selectedAdmin, tab]);

  async function cerrarSesion(id) {
    setBusy(true);
    setError("");
    try {
      await saasApi.adminAccesoCerrarSesion(id);
      await loadSesiones();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePermiso(code) {
    setPermisos((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function guardarPermisos() {
    if (!selectedAdmin) return;
    setBusy(true);
    setError("");
    try {
      await saasApi.adminAdminGuardarPermisos(selectedAdmin, { permisos });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Usuarios de plataforma</p>
          <h2>Gestión de acceso</h2>
          <p className="mod-desc">
            Sesiones activas, permisos de plataforma e historial de accesos.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      <div className="mod-tabs">
        <button
          type="button"
          className={tab === "sesiones" ? "active" : ""}
          onClick={() => setTab("sesiones")}
        >
          <MaterialIcon name="devices" />
          Sesiones activas
        </button>
        <button
          type="button"
          className={tab === "permisos" ? "active" : ""}
          onClick={() => setTab("permisos")}
        >
          <MaterialIcon name="shield_person" />
          Permisos de plataforma
        </button>
        <button
          type="button"
          className={tab === "historial" ? "active" : ""}
          onClick={() => setTab("historial")}
        >
          <MaterialIcon name="manage_history" />
          Historial de accesos
        </button>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando…</p>
      ) : (
        <>
          {tab === "sesiones" && (
            <section className="panel-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Institución</th>
                    <th>IP</th>
                    <th>Última actividad</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sesiones.length === 0 && (
                    <tr>
                      <td colSpan={5} className="mod-muted">
                        No hay sesiones activas de administradores.
                      </td>
                    </tr>
                  )}
                  {sesiones.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.user_name}</strong>
                        <div className="mod-muted">{s.user_email}</div>
                      </td>
                      <td>{s.institucion_nombre || "—"}</td>
                      <td>{s.ip_address || "—"}</td>
                      <td>{fmt(s.last_seen)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger"
                          disabled={busy}
                          onClick={() => cerrarSesion(s.id)}
                        >
                          Cerrar sesión
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "permisos" && (
            <section className="panel-card">
              <label style={{ display: "grid", gap: 6, maxWidth: 420, marginBottom: 16 }}>
                Administrador institucional
                <select
                  value={selectedAdmin}
                  onChange={(e) => setSelectedAdmin(e.target.value)}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "0.55rem 0.75rem",
                    font: "inherit",
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} · {a.institucion_nombre}
                    </option>
                  ))}
                </select>
              </label>

              {!selectedAdmin ? (
                <p className="mod-muted">Selecciona un administrador para gestionar permisos.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gap: "0.65rem", marginBottom: 16 }}>
                    {catalogo.map((p) => (
                      <label
                        key={p.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={permisos.includes(p.code)}
                          onChange={() => togglePermiso(p.code)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={busy}
                    onClick={guardarPermisos}
                  >
                    Guardar permisos
                  </button>
                </>
              )}
            </section>
          )}

          {tab === "historial" && (
            <section className="panel-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Actor</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={5} className="mod-muted">
                        Sin historial todavía.
                      </td>
                    </tr>
                  )}
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td>{fmt(h.creado_en)}</td>
                      <td>
                        <strong>{h.usuario_nombre}</strong>
                        <div className="mod-muted">{h.usuario_email}</div>
                        {h.institucion_nombre && (
                          <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
                            {h.institucion_nombre}
                          </div>
                        )}
                      </td>
                      <td>{h.accion_label || h.accion}</td>
                      <td className="mod-muted">{h.actor_email || "—"}</td>
                      <td className="mod-muted">{h.detalle || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
