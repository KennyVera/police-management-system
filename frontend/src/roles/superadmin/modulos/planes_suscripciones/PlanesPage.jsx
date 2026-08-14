import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { saasApi } from "../../../../saas/api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

const MODULOS_OPTS = [
  "operativo",
  "despacho",
  "tactico",
  "reportes",
  "estrategico",
  "sso",
  "gps",
  "multimedia",
];

const EMPTY = {
  codigo: "",
  nombre: "",
  descripcion: "",
  audiencia: "",
  precio_mensual: "0",
  precio_anual: "",
  limite_usuarios: 25,
  almacenamiento_gb: 50,
  tiene_analitica_avanzada: false,
  on_premise: false,
  modulos: [],
  caracteristicas: "",
  activo: true,
  orden: 0,
};

function money(v) {
  return Number(v || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function PlanFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleModulo(m) {
    setForm((f) => {
      const setM = new Set(f.modulos || []);
      if (setM.has(m)) setM.delete(m);
      else setM.add(m);
      return { ...f, modulos: [...setM] };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...form,
      precio_mensual: Number(form.precio_mensual || 0),
      precio_anual: form.precio_anual === "" || form.precio_anual == null
        ? null
        : Number(form.precio_anual),
      limite_usuarios: Number(form.limite_usuarios || 0),
      almacenamiento_gb: Number(form.almacenamiento_gb || 0),
      orden: Number(form.orden || 0),
      modulos: form.modulos || [],
    };
    try {
      if (isEdit) await saasApi.adminPlanEditar(initial.id, body);
      else await saasApi.adminPlanCrear(body);
      onSaved();
      onClose();
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
        style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>{isEdit ? "Editar plan" : "Crear plan"}</h3>
        <p className="mod-muted" style={{ marginTop: 0 }}>
          Precios, límites, módulos y características del catálogo comercial.
        </p>
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label>
            Código
            <input
              required
              value={form.codigo}
              onChange={(e) => set("codigo", e.target.value.toUpperCase())}
              placeholder="BASICO"
              disabled={isEdit}
            />
          </label>
          <label>
            Nombre
            <input
              required
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </label>
          <label>
            Audiencia
            <input
              value={form.audiencia}
              onChange={(e) => set("audiencia", e.target.value)}
              placeholder="Municipal / Privada / Enterprise"
            />
          </label>
          <label>
            Orden
            <input
              type="number"
              min={0}
              value={form.orden}
              onChange={(e) => set("orden", e.target.value)}
            />
          </label>
          <label>
            Precio mensual (USD)
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={form.precio_mensual}
              onChange={(e) => set("precio_mensual", e.target.value)}
            />
          </label>
          <label>
            Precio anual (USD)
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.precio_anual ?? ""}
              onChange={(e) => set("precio_anual", e.target.value)}
            />
          </label>
          <label>
            Límite usuarios
            <input
              type="number"
              min={1}
              value={form.limite_usuarios}
              onChange={(e) => set("limite_usuarios", e.target.value)}
            />
          </label>
          <label>
            Almacenamiento (GB)
            <input
              type="number"
              min={1}
              value={form.almacenamiento_gb}
              onChange={(e) => set("almacenamiento_gb", e.target.value)}
            />
          </label>
          <label className="full">
            Descripción
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </label>
          <label className="full">
            Características (una por línea)
            <textarea
              rows={3}
              value={form.caracteristicas}
              onChange={(e) => set("caracteristicas", e.target.value)}
            />
          </label>
          <div className="full">
            <span className="mod-muted" style={{ fontWeight: 700 }}>
              Módulos incluidos
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: 8 }}>
              {MODULOS_OPTS.map((m) => {
                const on = (form.modulos || []).includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    className={on ? "btn-accent" : "btn-ghost"}
                    style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                    onClick={() => toggleModulo(m)}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(form.tiene_analitica_avanzada)}
              onChange={(e) => set("tiene_analitica_avanzada", e.target.checked)}
            />
            Analítica avanzada
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(form.on_premise)}
              onChange={(e) => set("on_premise", e.target.checked)}
            />
            On-premise
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(form.activo)}
              onChange={(e) => set("activo", e.target.checked)}
            />
            Activo en catálogo
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlanesPage() {
  const [planes, setPlanes] = useState([]);
  const [showArchivados, setShowArchivados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [institucionesModal, setInstitucionesModal] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await saasApi.adminPlanes(showArchivados);
      setPlanes(data.planes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showArchivados]);

  const visibles = useMemo(() => planes, [planes]);

  async function runAction(id, fn) {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function verInstituciones(plan) {
    setBusyId(plan.id);
    setError("");
    try {
      const data = await saasApi.adminPlanInstituciones(plan.id);
      setInstitucionesModal(data);
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
          <p className="mod-kicker">Planes y suscripciones</p>
          <h2>Planes</h2>
          <p className="mod-desc">
            Crear planes, precios, límites, módulos y características.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowArchivados((v) => !v)}
          >
            <MaterialIcon name={showArchivados ? "list" : "inventory_2"} />
            {showArchivados ? "Ver planes activos" : "Ver archivados"}
          </button>
          <button type="button" className="btn-ghost" onClick={load}>
            <MaterialIcon name="refresh" />
            Actualizar
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={() => setForm({ ...EMPTY })}
          >
            <MaterialIcon name="add" />
            Crear plan
          </button>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando planes…</p>
      ) : (
        <section className="panel-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Precio</th>
                <th>Límites</th>
                <th>Módulos</th>
                <th>Estado</th>
                <th>Instituciones</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="mod-muted">
                    No hay planes para mostrar.
                  </td>
                </tr>
              )}
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nombre}</strong>
                    <div className="mod-muted">{p.codigo}</div>
                    {p.audiencia && (
                      <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
                        {p.audiencia}
                      </div>
                    )}
                  </td>
                  <td>
                    {money(p.precio_mensual)}
                    <span className="mod-muted"> /mes</span>
                    {p.precio_anual != null && (
                      <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
                        {money(p.precio_anual)} /año
                      </div>
                    )}
                  </td>
                  <td>
                    {p.limite_usuarios} usuarios
                    <div className="mod-muted">{p.almacenamiento_gb} GB</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(p.modulos || []).slice(0, 4).map((m) => (
                        <span key={m} className="pill">
                          {m}
                        </span>
                      ))}
                      {(p.modulos || []).length > 4 && (
                        <span className="mod-muted">+{p.modulos.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {p.archivado ? (
                      <span className="pill">Archivado</span>
                    ) : (
                      <span className={`pill ${p.activo ? "ok" : "bad"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    )}
                  </td>
                  <td>{p.instituciones_count ?? 0}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === p.id}
                        onClick={() => setForm(p)}
                        title="Editar"
                      >
                        <MaterialIcon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === p.id}
                        onClick={() =>
                          runAction(p.id, () => saasApi.adminPlanDuplicar(p.id))
                        }
                        title="Duplicar"
                      >
                        <MaterialIcon name="content_copy" />
                      </button>
                      {!p.archivado && (
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busyId === p.id}
                          onClick={() =>
                            runAction(p.id, () =>
                              saasApi.adminPlanActivar(p.id, !p.activo)
                            )
                          }
                          title={p.activo ? "Desactivar" : "Activar"}
                        >
                          <MaterialIcon
                            name={p.activo ? "toggle_on" : "toggle_off"}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === p.id}
                        onClick={() =>
                          runAction(p.id, () =>
                            saasApi.adminPlanArchivar(p.id, !p.archivado)
                          )
                        }
                        title={p.archivado ? "Desarchivar" : "Archivar"}
                      >
                        <MaterialIcon name="archive" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === p.id}
                        onClick={() => verInstituciones(p)}
                        title="Instituciones que lo usan"
                      >
                        <MaterialIcon name="domain" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {form && (
        <PlanFormModal
          initial={form}
          onClose={() => setForm(null)}
          onSaved={load}
        />
      )}

      {institucionesModal && (
        <div className="modal-backdrop" onClick={() => setInstitucionesModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 720, maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Instituciones · {institucionesModal.plan?.nombre}</h3>
            <p className="mod-muted" style={{ marginTop: 0 }}>
              Tenants que utilizan este plan actualmente.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                </tr>
              </thead>
              <tbody>
                {(institucionesModal.instituciones || []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="mod-muted">
                      Ninguna institución usa este plan.
                    </td>
                  </tr>
                )}
                {(institucionesModal.instituciones || []).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.nombre_comercial}</strong>
                      <div className="mod-muted">{i.ruc}</div>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          i.estado_pago === "SUSPENDIDO" ||
                          i.estado_pago === "CANCELADO"
                            ? "bad"
                            : "ok"
                        }`}
                      >
                        {i.estado_pago_label || i.estado_pago}
                      </span>
                    </td>
                    <td>{i.usuarios_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setInstitucionesModal(null)}
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
