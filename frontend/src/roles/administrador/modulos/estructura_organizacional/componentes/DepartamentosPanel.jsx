import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { estructuraApi } from "../../../api";

export default function DepartamentosPanel({ items, onChanged }) {
  const [form, setForm] = useState({ nombre: "", codigo: "", descripcion: "" });
  const [error, setError] = useState("");

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await estructuraApi.createDepartamento(form);
      setForm({ nombre: "", codigo: "", descripcion: "" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form className="panel-card form-grid" onSubmit={create}>
        <h3 className="full" style={{ margin: 0 }}>
          Nuevo departamento / unidad
        </h3>
        {error && <p className="mod-error full">{error}</p>}
        <label>
          Código
          <input
            required
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            placeholder="DINASED"
          />
        </label>
        <label>
          Nombre
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Unidad de Cibercrimen"
          />
        </label>
        <label className="full">
          Descripción
          <textarea
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="add" />
            Crear departamento
          </button>
        </div>
      </form>

      <div className="panel-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.codigo}</td>
                <td>{d.nombre}</td>
                <td>{d.descripcion || "—"}</td>
                <td>
                  <span className={`badge-estado ${d.activo ? "ACTIVO" : "BAJA"}`}>
                    {d.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
                <td>
                  {d.activo && (
                    <button
                      type="button"
                      className="btn-warn"
                      onClick={async () => {
                        await estructuraApi.inactivarDepartamento(d.id);
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
