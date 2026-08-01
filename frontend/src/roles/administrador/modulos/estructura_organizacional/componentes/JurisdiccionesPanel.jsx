import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { estructuraApi } from "../../../api";

export default function JurisdiccionesPanel({ tipos, items, onChanged }) {
  const [form, setForm] = useState({
    tipo: "ZONA",
    nombre: "",
    codigo: "",
    parent: "",
  });
  const [error, setError] = useState("");

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
          <input
            required
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          />
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
              <th>Padre</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr key={j.id}>
                <td>{j.tipo_label}</td>
                <td>{j.codigo}</td>
                <td>{j.nombre}</td>
                <td>{j.parent_nombre || "—"}</td>
                <td>
                  <span className={`badge-estado ${j.activo ? "ACTIVO" : "BAJA"}`}>
                    {j.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
