import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import FlotaCatalogo from "./componentes/FlotaCatalogo";
import { CATALOGO_FLOTA, TIPOS_CATALOGO } from "./componentes/catalogoFlota";
import "../../../../shared/styles/ModuloPage.css";
import "./componentes/FlotaRegistro.css";

export default function VehiculosPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ placa: "", tipo: "AUTOMOVIL", descripcion: "" });
  const [catalogoId, setCatalogoId] = useState("automovil");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await supervisorApi.listVehiculos());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function pickCatalogo(item) {
    setCatalogoId(item.id);
    setForm((prev) => ({
      ...prev,
      tipo: item.tipo,
      descripcion: prev.descripcion?.trim() ? prev.descripcion : item.descripcion,
    }));
  }

  function onTipoChange(tipo) {
    const match = CATALOGO_FLOTA.find((c) => c.tipo === tipo);
    setForm((prev) => ({
      ...prev,
      tipo,
      descripcion: prev.descripcion?.trim()
        ? prev.descripcion
        : match?.descripcion || prev.descripcion,
    }));
    if (match) setCatalogoId(match.id);
  }

  async function createVehiculo(e) {
    e.preventDefault();
    try {
      await supervisorApi.createVehiculo(form);
      setForm({ placa: "", tipo: "AUTOMOVIL", descripcion: "" });
      setCatalogoId("automovil");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Gestión de Turnos · Logística Diaria</p>
          <h2>Flota de Vehículos</h2>
          <p className="mod-desc">
            Registra patrulleros y motocicletas. La asignación al turno se hace desde Escuadras.
          </p>
        </div>
      </header>
      {error && <p className="mod-error">{error}</p>}

      <section className="panel-card flota-registro">
        <form className="flota-registro-form" onSubmit={createVehiculo}>
          <h3>Registrar vehículo en flota</h3>
          <div className="form-grid">
            <label>
              Placa
              <input
                required
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Tipo
              <select value={form.tipo} onChange={(e) => onTipoChange(e.target.value)}>
                {TIPOS_CATALOGO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Descripción
              <input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </label>
            <div className="full">
              <button type="submit" className="btn-accent">
                <MaterialIcon name="add" />
                Agregar
              </button>
            </div>
          </div>
        </form>

        <FlotaCatalogo selectedId={catalogoId} onSelect={pickCatalogo} />
      </section>

      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <div className="panel-card" style={{ overflowX: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Vehículos registrados</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id}>
                  <td>{v.placa}</td>
                  <td>{v.tipo_label}</td>
                  <td>{v.descripcion || "—"}</td>
                  <td>
                    <span className={`badge-estado ${v.activo ? "ACTIVO" : "BAJA"}`}>
                      {v.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={4} className="mod-muted">
                    Sin vehículos en flota.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
