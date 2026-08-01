import { useMemo, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { catalogosApi } from "../../../api";

export default function CatalogosOperativosPanel({ tipos, items, onChanged }) {
  const [filtro, setFiltro] = useState("");
  const [form, setForm] = useState({
    tipo: tipos[0]?.code || "MARCA_VEHICULO",
    codigo: "",
    nombre: "",
    descripcion: "",
  });
  const [error, setError] = useState("");

  const filtrados = useMemo(() => {
    if (!filtro) return items;
    return items.filter((i) => i.tipo === filtro);
  }, [items, filtro]);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await catalogosApi.createOperativo(form);
      setForm({ ...form, codigo: "", nombre: "", descripcion: "" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form className="panel-card form-grid" onSubmit={create}>
        <h3 className="full" style={{ margin: 0 }}>
          Nuevo ítem de catálogo operativo
        </h3>
        {error && <p className="mod-error full">{error}</p>}
        <label>
          Catálogo
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
            onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
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
            Agregar ítem
          </button>
        </div>
      </form>

      <div className="panel-card">
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.3rem", maxWidth: 320 }}>
            Filtrar por catálogo
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Catálogo</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id}>
                <td>{i.tipo_label}</td>
                <td>{i.codigo}</td>
                <td>{i.nombre}</td>
                <td>
                  <span className={`badge-estado ${i.activo ? "ACTIVO" : "BAJA"}`}>
                    {i.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </td>
                <td>
                  {i.activo && (
                    <button
                      type="button"
                      className="btn-warn"
                      onClick={async () => {
                        await catalogosApi.inactivarOperativo(i.id);
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
