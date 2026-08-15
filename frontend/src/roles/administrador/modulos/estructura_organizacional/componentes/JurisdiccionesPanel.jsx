import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { estructuraApi } from "../../../api";

const TIPO_PREFIX = {
  ZONA: "ZN",
  SUBZONA: "SZ",
  DISTRITO: "DT",
  CIRCUITO: "CR",
  SUBCIRCUITO: "SC",
};

function slugFromName(nombre) {
  return (nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
}

function generarCodigo({ tipo, nombre, parentId, items }) {
  const prefix = TIPO_PREFIX[tipo] || "JR";
  const parent = items.find((j) => String(j.id) === String(parentId));
  const used = new Set(items.map((j) => (j.codigo || "").toUpperCase()));

  const baseParts = [];
  if (parent?.codigo) {
    baseParts.push(String(parent.codigo).toUpperCase());
  } else {
    baseParts.push(prefix);
  }

  const slug = slugFromName(nombre);
  if (slug) baseParts.push(slug);

  let candidate = baseParts.join("-");
  if (!used.has(candidate) && candidate.length >= 3) return candidate;

  // Secuencia numérica única: ZN-001, ZN-002… o bajo el padre
  const root = parent?.codigo ? String(parent.codigo).toUpperCase() : prefix;
  for (let n = 1; n <= 9999; n += 1) {
    const seq = String(n).padStart(3, "0");
    candidate = `${root}-${seq}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36).toUpperCase()}`;
}

export default function JurisdiccionesPanel({ tipos, items, onChanged }) {
  const [form, setForm] = useState({
    tipo: "ZONA",
    nombre: "",
    codigo: "",
    parent: "",
  });
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  function generarCodigoAuto() {
    const codigo = generarCodigo({
      tipo: form.tipo,
      nombre: form.nombre,
      parentId: form.parent,
      items,
    });
    setForm((f) => ({ ...f, codigo }));
    setError("");
  }

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await estructuraApi.createJurisdiccion({
        ...form,
        parent: form.parent ? Number(form.parent) : null,
      });
      setForm({ tipo: "ZONA", nombre: "", codigo: "", parent: "" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function verPersonal(j) {
    setDetalleLoading(true);
    setError("");
    try {
      setDetalle(await estructuraApi.jurisdiccionPersonal(j.id));
    } catch (err) {
      setError(err.message);
      setDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form className="panel-card form-grid" onSubmit={create}>
        <h3 className="full" style={{ margin: 0 }}>
          Nueva jurisdicción
        </h3>
        {error && <p className="mod-error full">{error}</p>}
        <label>
          Tipo
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {tipos.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Código
          <div className="jur-codigo-row">
            <input
              required
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="Ej. ZN-NORTE"
            />
            <button
              type="button"
              className="btn-ghost"
              title="Generar código automático único"
              onClick={generarCodigoAuto}
            >
              <MaterialIcon name="auto_awesome" />
              Generar
            </button>
          </div>
        </label>
        <label className="full">
          Nombre
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </label>
        <label className="full">
          Padre (opcional)
          <select
            value={form.parent}
            onChange={(e) => setForm({ ...form, parent: e.target.value })}
          >
            <option value="">— Sin padre —</option>
            {items
              .filter((j) => j.activo)
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.tipo_label}: {j.nombre}
                </option>
              ))}
          </select>
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="add" />
            Crear
          </button>
        </div>
      </form>

      <div className="panel-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Jefe de Zona</th>
              <th>Personal</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr key={j.id}>
                <td>{j.tipo_label}</td>
                <td>{j.codigo}</td>
                <td>{j.nombre}</td>
                <td>{j.jefe_zona?.nombre || "— Sin jefe —"}</td>
                <td>{j.personal_count ?? "—"}</td>
                <td>
                  <span className={`badge-estado ${j.activo ? "ACTIVO" : "BAJA"}`}>
                    {j.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" title="Ver personal" onClick={() => verPersonal(j)}>
                      <MaterialIcon name="groups" />
                      Personal
                    </button>
                    {j.activo && (
                      <button
                        type="button"
                        className="btn-warn"
                        onClick={async () => {
                          await estructuraApi.inactivarJurisdiccion(j.id);
                          onChanged();
                        }}
                      >
                        Inactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(detalle || detalleLoading) && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div
            className="modal-card"
            style={{ width: "min(720px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  Personal en {detalle?.jurisdiccion?.nombre || "…"}
                </h3>
                <p className="mod-muted" style={{ margin: "0.25rem 0 0" }}>
                  {detalle?.jefe_zona
                    ? `Jefe de Zona: ${detalle.jefe_zona.nombre}`
                    : "Sin Jefe de Zona asignado"}
                  {detalle ? ` · ${detalle.total} funcionario(s)` : ""}
                </p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
            {detalleLoading ? (
              <p className="mod-muted">Cargando personal…</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Funcionario</th>
                    <th>Rol</th>
                    <th>Placa</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle?.personal || []).length === 0 && (
                    <tr>
                      <td colSpan={4}>Nadie asignado aún a esta zona.</td>
                    </tr>
                  )}
                  {(detalle?.personal || []).map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>
                          {u.first_name} {u.last_name}
                        </strong>
                        <div className="mod-muted">{u.email}</div>
                      </td>
                      <td>{u.role_label}</td>
                      <td>{u.placa || "—"}</td>
                      <td>
                        <span className={`badge-estado ${u.estado}`}>{u.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
