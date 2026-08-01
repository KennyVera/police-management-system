import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { catalogosApi } from "../../../api";

export default function TiposDelitosPanel({ items, onChanged }) {
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    articulo_penal: "",
    codigo_iucr: "",
    clasificacion_fbi: "",
    descripcion: "",
  });
  const [error, setError] = useState("");

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await catalogosApi.createDelito(form);
      setForm({
        codigo: "",
        nombre: "",
        articulo_penal: "",
        codigo_iucr: "",
        clasificacion_fbi: "",
        descripcion: "",
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form className="panel-card form-grid" onSubmit={create}>
        <h3 className="full" style={{ margin: 0 }}>
          Nuevo tipo de delito
        </h3>
        {error && <p className="mod-error full">{error}</p>}
        <label>
          Código
          <input
            required
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            placeholder="EXTORSION_DIGITAL"
          />
        </label>
        <label>
          Nombre
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Extorsión digital"
          />
        </label>
        <label>
          Código IUCR
          <input
            value={form.codigo_iucr}
            onChange={(e) => setForm({ ...form, codigo_iucr: e.target.value })}
            placeholder="120"
          />
        </label>
        <label>
          Clasificación FBI
          <input
            value={form.clasificacion_fbi}
            onChange={(e) => setForm({ ...form, clasificacion_fbi: e.target.value })}
            placeholder="Robo / Property crime"
          />
        </label>
        <label className="full">
          Artículo / referencia penal
          <input
            value={form.articulo_penal}
            onChange={(e) => setForm({ ...form, articulo_penal: e.target.value })}
          />
        </label>
        <label className="full">
          Descripción
          <textarea
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="add" />
            Agregar delito
          </button>
        </div>
      </form>

      <div className="panel-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>IUCR</th>
              <th>Clasificación FBI</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.codigo}</td>
                <td>{d.nombre}</td>
                <td>{d.codigo_iucr || "—"}</td>
                <td>{d.clasificacion_fbi || "—"}</td>
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
                        await catalogosApi.inactivarDelito(d.id);
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
