import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import FlotaCatalogo from "./componentes/FlotaCatalogo";
import TipoUnidadFormulario from "./componentes/TipoUnidadFormulario";
import VehiculoEditModal from "./componentes/VehiculoEditModal";
import {
  hydrateCatalogItem,
  loadCatalogo,
  saveCatalogo,
  tipoParaRegistro,
  tiposFromCatalogo,
} from "./componentes/catalogoFlota";
import "../../../../shared/styles/ModuloPage.css";
import "./componentes/FlotaRegistro.css";

const emptyForm = (catalogo = []) => ({
  placa: "",
  tipo: catalogo[0] ? tipoParaRegistro(catalogo[0]) : "AUTOMOVIL",
  descripcion: "",
});

export default function VehiculosPage() {
  const [catalogo, setCatalogo] = useState(() => loadCatalogo());
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => emptyForm(loadCatalogo()));
  const [catalogoId, setCatalogoId] = useState(() => loadCatalogo()[0]?.id || "");
  const [tipoForm, setTipoForm] = useState(null);
  const [confirmDeleteTipo, setConfirmDeleteTipo] = useState(null);
  const [editVehiculo, setEditVehiculo] = useState(null);
  const [confirmDeleteVehiculo, setConfirmDeleteVehiculo] = useState(null);
  const [busyVehiculo, setBusyVehiculo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function persistCatalogo(next) {
    const hydrated = next.map(hydrateCatalogItem);
    setCatalogo(hydrated);
    saveCatalogo(hydrated);
    return hydrated;
  }

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
      tipo: tipoParaRegistro(item),
      descripcion: prev.descripcion?.trim()
        ? prev.descripcion
        : item.alias || item.descripcion || "",
    }));
  }

  function onTipoChange(tipo) {
    const match = catalogo.find((c) => c.tipo === tipo);
    setForm((prev) => ({
      ...prev,
      tipo,
      descripcion: prev.descripcion?.trim()
        ? prev.descripcion
        : match?.alias || match?.descripcion || prev.descripcion,
    }));
    if (match) setCatalogoId(match.id);
  }

  function limpiarForm() {
    const first = catalogo[0];
    setForm(emptyForm(catalogo));
    setCatalogoId(first?.id || "");
  }

  async function createVehiculo(e) {
    e.preventDefault();
    try {
      await supervisorApi.createVehiculo(form);
      limpiarForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleTipoSaved(nextItem) {
    const exists = catalogo.some((c) => c.id === nextItem.id);
    const next = exists
      ? catalogo.map((c) => (c.id === nextItem.id ? nextItem : c))
      : [...catalogo, nextItem];
    const hydrated = persistCatalogo(next);
    setTipoForm(null);
    if (!exists) {
      const created = hydrated.find((c) => c.id === nextItem.id);
      if (created) pickCatalogo(created);
    } else if (catalogoId === nextItem.id) {
      const updated = hydrated.find((c) => c.id === nextItem.id);
      if (updated) pickCatalogo(updated);
    }
  }

  function handleConfirmDeleteTipo() {
    if (!confirmDeleteTipo) return;
    const next = catalogo.filter((c) => c.id !== confirmDeleteTipo.id);
    persistCatalogo(next);
    if (catalogoId === confirmDeleteTipo.id) {
      const first = next[0];
      setCatalogoId(first?.id || "");
      if (first) pickCatalogo(first);
      else setForm(emptyForm([]));
    }
    setConfirmDeleteTipo(null);
  }

  async function handleConfirmDeleteVehiculo() {
    if (!confirmDeleteVehiculo) return;
    setBusyVehiculo(true);
    setError("");
    try {
      await supervisorApi.updateVehiculo(confirmDeleteVehiculo.id, { activo: false });
      setConfirmDeleteVehiculo(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyVehiculo(false);
    }
  }

  const tiposSelect = tiposFromCatalogo(catalogo);
  if (!tiposSelect.some((t) => t.value === "OTRO")) {
    tiposSelect.push({ value: "OTRO", label: "Otro" });
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
                placeholder="Ej: PBA-1234"
                onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Tipo
              <select value={form.tipo} onChange={(e) => onTipoChange(e.target.value)}>
                {tiposSelect.map((t) => (
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
                placeholder="Ej: Helicóptero de apoyo aéreo"
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </label>
            <div className="full flota-registro-actions">
              <button type="submit" className="btn-accent">
                <MaterialIcon name="add" />
                Agregar vehículo
              </button>
              <button type="button" className="btn-ghost" onClick={limpiarForm}>
                <MaterialIcon name="refresh" />
                Limpiar
              </button>
            </div>
          </div>
        </form>

        <FlotaCatalogo
          items={catalogo}
          selectedId={catalogoId}
          onSelect={pickCatalogo}
          onNuevo={() => setTipoForm("new")}
          onEditar={(item) => setTipoForm(item)}
          onEliminar={setConfirmDeleteTipo}
        />
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
                <th>Acciones</th>
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
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="flota-action edit"
                        title="Editar"
                        onClick={() => setEditVehiculo(v)}
                      >
                        <MaterialIcon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="flota-action delete"
                        title="Eliminar"
                        onClick={() => setConfirmDeleteVehiculo(v)}
                      >
                        <MaterialIcon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="mod-muted">
                    Sin vehículos en flota.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tipoForm && (
        <TipoUnidadFormulario
          item={tipoForm === "new" ? null : tipoForm}
          onClose={() => setTipoForm(null)}
          onSaved={handleTipoSaved}
        />
      )}

      {editVehiculo && (
        <VehiculoEditModal
          vehiculo={editVehiculo}
          tipos={tiposSelect}
          onClose={() => setEditVehiculo(null)}
          onSaved={() => {
            setEditVehiculo(null);
            load();
          }}
        />
      )}

      {confirmDeleteTipo && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteTipo(null)}>
          <div
            className="modal-card flota-confirm-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Eliminar tipo de unidad</h3>
            <p className="mod-muted" style={{ margin: 0 }}>
              ¿Seguro que deseas eliminar <strong>{confirmDeleteTipo.nombre}</strong> del catálogo?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteTipo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={handleConfirmDeleteTipo}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteVehiculo && (
        <div
          className="modal-backdrop"
          onClick={() => !busyVehiculo && setConfirmDeleteVehiculo(null)}
        >
          <div
            className="modal-card flota-confirm-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Eliminar vehículo</h3>
            <p className="mod-muted" style={{ margin: 0 }}>
              ¿Seguro que deseas eliminar el vehículo{" "}
              <strong>{confirmDeleteVehiculo.placa}</strong>? Quedará inactivo en la flota.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={busyVehiculo}
                onClick={() => setConfirmDeleteVehiculo(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={busyVehiculo}
                onClick={handleConfirmDeleteVehiculo}
              >
                {busyVehiculo ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
