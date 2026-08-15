import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { localISODate } from "../../../../shared/utils/date";
import { supervisorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./SectoresPage.css";
import CuadranteMapaModal from "./CuadranteMapaModal";

export default function SectoresPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [escuadras, setEscuadras] = useState([]);
  const [meta, setMeta] = useState({ zonas: [] });
  const [fecha, setFecha] = useState(localISODate());
  const [form, setForm] = useState({
    escuadra: "",
    zona: "",
    cuadrante: "",
    sector_detalle: "",
    poligono: null,
    latitud: null,
    longitud: null,
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editSector, setEditSector] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(f = fecha) {
    setLoading(true);
    setError("");
    try {
      const [list, esc, m] = await Promise.all([
        supervisorApi.listAsignaciones({ fecha: f, por_escuadra: 1 }),
        supervisorApi.listEscuadras({ fecha: f }),
        supervisorApi.meta(),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setEscuadras(Array.isArray(esc) ? esc : []);
      setMeta(m || { zonas: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const escuadrasDisponibles = useMemo(() => {
    return escuadras.filter((e) => e.activo !== false);
  }, [escuadras]);

  function onMapConfirm(sel) {
    setForm((f) => ({
      ...f,
      cuadrante: sel.cuadrante,
      sector_detalle: sel.sector_detalle,
      poligono: sel.poligono,
      latitud: sel.latitud,
      longitud: sel.longitud,
    }));
    setMapOpen(false);
    setMsg(`Cuadrante «${sel.cuadrante}» listo. Confirma con Asignar sector.`);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!form.escuadra) {
      setError("Selecciona una escuadra.");
      return;
    }
    if (!form.cuadrante || !form.poligono) {
      setError("Selecciona el lugar en el mapa (botón «Seleccionar en Mapa»).");
      return;
    }
    setSaving(true);
    try {
      const res = await supervisorApi.createAsignacion({
        fecha,
        escuadra: Number(form.escuadra),
        zona: form.zona ? Number(form.zona) : null,
        cuadrante: form.cuadrante,
        sector_detalle: form.sector_detalle,
        poligono: form.poligono,
        latitud: form.latitud,
        longitud: form.longitud,
        turno_inicio: "07:00:00",
        turno_fin: "19:00:00",
      });
      setMsg(res.detail || "Sector asignado a la escuadra.");
      setForm({
        escuadra: "",
        zona: "",
        cuadrante: "",
        sector_detalle: "",
        poligono: null,
        latitud: null,
        longitud: null,
      });
      await load(fecha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function guardarEdicion() {
    if (!editRow?.id && !editRow?.escuadra) return;
    setSaving(true);
    setError("");
    try {
      if (editRow.id) {
        await supervisorApi.updateAsignacion(editRow.id, {
          sector_detalle: editSector,
          escuadra_id: editRow.escuadra,
        });
      } else {
        await supervisorApi.createAsignacion({
          fecha: editRow.fecha || fecha,
          escuadra: editRow.escuadra,
          cuadrante: editRow.cuadrante || "Por definir",
          sector_detalle: editSector,
          zona: editRow.zona || null,
          poligono: editRow.poligono || null,
        });
      }
      setEditRow(null);
      setEditSector("");
      setMsg("Ruta actualizada para toda la escuadra.");
      await load(fecha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarRuta(row) {
    if (!row?.id) {
      setError("Esta escuadra aún no tiene una ruta asignada.");
      return;
    }
    const ok = await confirm({
      title: "Eliminar ruta",
      message: `¿Eliminar la ruta de «${row.escuadra_nombre || "la escuadra"}»? Se quita el sector de todos los integrantes.`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await supervisorApi.deleteAsignacion(row.id);
      setMsg(res.detail || "Ruta eliminada.");
      await load(fecha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Gestión de Turnos · Logística Diaria</p>
          <h2>Asignación de Sectores (Rutas)</h2>
          <p className="mod-desc">
            Asigna el sector de patrullaje a la escuadra completa. Elige el cuadrante en el
            mapa; se guardan el nombre, el detalle de ruta y el polígono GPS.
          </p>
        </div>
      </header>
      {error && <p className="mod-error">{error}</p>}
      {msg && <p className="mod-ok">{msg}</p>}

      <form className="panel-card form-grid" onSubmit={submit}>
        <h3 className="full" style={{ margin: 0 }}>
          Nueva asignación de sector
        </h3>
        <label>
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              setForm((f) => ({ ...f, escuadra: "" }));
            }}
          />
        </label>
        <label>
          Escuadra
          <select
            required
            value={form.escuadra}
            onChange={(e) => setForm({ ...form, escuadra: e.target.value })}
          >
            <option value="">Seleccione escuadra...</option>
            {escuadrasDisponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.agente_lider_info?.nombre
                  ? ` · Líder: ${e.agente_lider_info.nombre}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zona / jurisdicción
          <select
            value={form.zona}
            onChange={(e) => setForm({ ...form, zona: e.target.value })}
          >
            <option value="">Opcional</option>
            {(meta.zonas || []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cuadrante
          <div className="sector-cuadrante-row">
            <input
              required
              readOnly
              value={form.cuadrante}
              placeholder="Selecciona en el mapa…"
              title="Se completa al confirmar en el mapa"
            />
            <button
              type="button"
              className="btn-map-select"
              title="Abrir mapa de cuadrantes"
              onClick={() => setMapOpen(true)}
            >
              🗺️ Seleccionar en Mapa
            </button>
          </div>
        </label>
        <label className="full">
          Detalle de ruta / cuadras
          <input
            readOnly
            value={form.sector_detalle}
            placeholder="Se completa al confirmar la selección en el mapa"
            title="Se completa al confirmar en el mapa"
          />
          {form.poligono && (
            <span className="sector-geo-ok">
              <MaterialIcon name="check_circle" /> Polígono GPS listo para el agente operativo
            </span>
          )}
        </label>
        {!escuadrasDisponibles.length && (
          <p className="full mod-muted" style={{ margin: 0 }}>
            No hay escuadras activas para esta fecha. Crea una en{" "}
            <strong>Gestión de Escuadras</strong> primero.
          </p>
        )}
        <div className="full">
          <button type="submit" className="btn-accent" disabled={saving || !escuadrasDisponibles.length}>
            <MaterialIcon name="map" />
            {saving ? "Asignando…" : "Asignar sector"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: 8 }}
            onClick={() => load(fecha)}
          >
            Filtrar fecha
          </button>
        </div>
      </form>

      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <div className="panel-card" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Escuadra</th>
                <th>Integrantes</th>
                <th>Cuadrante</th>
                <th>Sector / ruta</th>
                <th>Zona</th>
                <th>GPS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.escuadra || a.id}>
                  <td>
                    <strong>{a.escuadra_nombre || "—"}</strong>
                  </td>
                  <td>{a.miembros ?? "—"}</td>
                  <td>{a.cuadrante || "—"}</td>
                  <td>{a.sector_detalle || "—"}</td>
                  <td>{a.zona_nombre || "—"}</td>
                  <td>{a.tiene_poligono ? "✓" : "—"}</td>
                  <td>
                    <div className="sector-row-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setEditRow(a);
                          setEditSector(a.sector_detalle || "");
                        }}
                      >
                        Editar ruta
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={saving || !a.id}
                        title={
                          a.id
                            ? "Eliminar ruta de la escuadra"
                            : "Sin ruta asignada"
                        }
                        onClick={() => eliminarRuta(a)}
                      >
                        <MaterialIcon name="delete" />
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="mod-muted">
                    Sin escuadras para esta fecha. Crea una escuadra y asígnale el sector.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <div className="modal-backdrop" onClick={() => setEditRow(null)} role="presentation">
          <div
            className="modal-card"
            style={{ width: "min(440px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0 }}>Editar ruta · {editRow.escuadra_nombre}</h3>
            <p className="mod-muted" style={{ margin: 0 }}>
              El cambio aplica a todos los integrantes de la escuadra.
            </p>
            <label className="stack-form">
              Detalle de ruta / cuadras
              <input
                value={editSector}
                onChange={(e) => setEditSector(e.target.value)}
                placeholder="Av. 10 de Agosto entre Colón y Patria"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditRow(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-accent"
                disabled={saving}
                onClick={guardarEdicion}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CuadranteMapaModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={onMapConfirm}
      />
    </div>
  );
}
