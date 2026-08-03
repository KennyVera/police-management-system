import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { localISODate } from "../../../../shared/utils/date";
import { supervisorApi } from "../../api";
import EscuadrasLista from "./componentes/EscuadrasLista";
import EscuadraFormulario from "./componentes/EscuadraFormulario";
import AsignarVehiculoModal from "./componentes/AsignarVehiculoModal";
import "./componentes/EscuadrasPage.css";
import "../../../../shared/styles/ModuloPage.css";

const emptyFilters = () => ({
  fecha: localISODate(),
  escuadra: "",
  lider: "",
  vehiculo: "",
  estado: "",
});

export default function EscuadrasPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ agentes: [] });
  const [vehiculos, setVehiculos] = useState([]);
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [showForm, setShowForm] = useState(false);
  const [escuadraEditar, setEscuadraEditar] = useState(null);
  const [showAsignar, setShowAsignar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(fecha = applied.fecha) {
    setLoading(true);
    setError("");
    try {
      const [list, m, veh] = await Promise.all([
        supervisorApi.listEscuadras({ fecha }),
        supervisorApi.meta(),
        supervisorApi.listVehiculos(),
      ]);
      setItems(list);
      setMeta(m);
      setVehiculos(veh);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (applied.escuadra && String(e.id) !== String(applied.escuadra)) return false;
      if (applied.lider && String(e.agente_lider) !== String(applied.lider)) return false;
      if (applied.vehiculo) {
        if (applied.vehiculo === "__none__") {
          if (e.vehiculo) return false;
        } else if (String(e.vehiculo) !== String(applied.vehiculo)) {
          return false;
        }
      }
      if (applied.estado === "PENDIENTE" && e.vehiculo) return false;
      if (applied.estado === "ASIGNADA" && !e.vehiculo) return false;
      return true;
    });
  }, [items, applied]);

  function handleBuscar(e) {
    e?.preventDefault?.();
    const next = { ...draft };
    setApplied(next);
    load(next.fecha);
  }

  function handleLimpiar() {
    const next = emptyFilters();
    setDraft(next);
    setApplied(next);
    load(next.fecha);
  }

  async function confirmarEliminar() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError("");
    try {
      await supervisorApi.inactivarEscuadra(confirmDelete.id);
      setConfirmDelete(null);
      load(applied.fecha);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Gestión de Turnos · Logística Diaria</p>
          <h2>Asignación de Escuadras</h2>
          <p className="mod-desc">
            Crea los grupos de trabajo diarios y asigna el vehículo del turno.
          </p>
        </div>
        <div className="escuadras-header-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowAsignar(true)}
            disabled={!items.length}
          >
            <MaterialIcon name="directions_car" />
            Asignar vehículo
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={() => {
              setEscuadraEditar(null);
              setShowForm(true);
            }}
          >
            <MaterialIcon name="add" />
            Nueva escuadra
          </button>
        </div>
      </header>

      <form className="panel-card escuadras-filters" onSubmit={handleBuscar}>
        <p className="escuadras-filters-head">
          <MaterialIcon name="filter_alt" />
          Criterios de búsqueda
        </p>
        <div className="escuadras-filters-grid">
          <label>
            Fecha
            <input
              type="date"
              value={draft.fecha}
              onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
            />
          </label>
          <label>
            Escuadra
            <select
              value={draft.escuadra}
              onChange={(e) => setDraft({ ...draft, escuadra: e.target.value })}
            >
              <option value="">Seleccionar escuadra</option>
              {items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Líder
            <select
              value={draft.lider}
              onChange={(e) => setDraft({ ...draft, lider: e.target.value })}
            >
              <option value="">Seleccionar líder</option>
              {(meta.agentes || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vehículo
            <select
              value={draft.vehiculo}
              onChange={(e) => setDraft({ ...draft, vehiculo: e.target.value })}
            >
              <option value="">Seleccionar vehículo</option>
              <option value="__none__">Sin asignar</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.tipo_label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={draft.estado}
              onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
            >
              <option value="">Seleccionar estado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ASIGNADA">Asignada</option>
            </select>
          </label>
        </div>
        <div className="escuadras-filters-actions">
          <button type="button" className="btn-ghost" onClick={handleLimpiar}>
            <MaterialIcon name="refresh" />
            Limpiar
          </button>
          <button type="submit" className="btn-accent">
            <MaterialIcon name="search" />
            Buscar
          </button>
        </div>
      </form>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <EscuadrasLista
          items={filtered}
          fecha={applied.fecha}
          onEditar={(e) => {
            setEscuadraEditar(e);
            setShowForm(true);
          }}
          onEliminar={setConfirmDelete}
        />
      )}

      {showForm && (
        <EscuadraFormulario
          agentes={meta.agentes || []}
          fechaDefault={applied.fecha}
          escuadra={escuadraEditar}
          onClose={() => {
            setShowForm(false);
            setEscuadraEditar(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEscuadraEditar(null);
            load(applied.fecha);
          }}
        />
      )}

      {showAsignar && (
        <AsignarVehiculoModal
          escuadras={items}
          vehiculos={vehiculos}
          onClose={() => setShowAsignar(false)}
          onSaved={() => {
            setShowAsignar(false);
            load(applied.fecha);
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => !deleting && setConfirmDelete(null)}>
          <div
            className="modal-card escuadras-confirm-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Inactivar escuadra</h3>
            <p className="mod-muted" style={{ margin: 0 }}>
              ¿Seguro que deseas inactivar la escuadra{" "}
              <strong>{confirmDelete.nombre}</strong>? Dejará de aparecer en la bandeja activa.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={confirmarEliminar}
              >
                {deleting ? "Inactivando..." : "Sí, inactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
