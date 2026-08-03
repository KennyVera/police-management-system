import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { localISODate } from "../../../../shared/utils/date";
import { supervisorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

export default function SectoresPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ agentes: [], zonas: [] });
  const [fecha, setFecha] = useState(localISODate());
  const [form, setForm] = useState({
    agente: "",
    zona: "",
    cuadrante: "",
    sector_detalle: "",
    turno_inicio: "07:00",
    turno_fin: "19:00",
    vehiculo_placa: "S/P",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(f = fecha) {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        supervisorApi.listAsignaciones({ fecha: f }),
        supervisorApi.meta(),
      ]);
      setItems(list);
      setMeta(m);
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

  async function submit(e) {
    e.preventDefault();
    try {
      await supervisorApi.createAsignacion({
        fecha,
        agente: Number(form.agente),
        zona: form.zona ? Number(form.zona) : null,
        cuadrante: form.cuadrante,
        sector_detalle: form.sector_detalle,
        vehiculo_placa: form.vehiculo_placa || "S/P",
        vehiculo_tipo: "Patrulla",
        turno_inicio: `${form.turno_inicio}:00`,
        turno_fin: `${form.turno_fin}:00`,
      });
      setForm({
        agente: "",
        zona: "",
        cuadrante: "",
        sector_detalle: "",
        turno_inicio: "07:00",
        turno_fin: "19:00",
        vehiculo_placa: "S/P",
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateSector(id, patch) {
    try {
      await supervisorApi.updateAsignacion(id, patch);
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
          <h2>Asignación de Sectores (Rutas)</h2>
          <p className="mod-desc">
            Designa subcircuito o cuadras específicas a cada patrulla durante su guardia.
          </p>
        </div>
      </header>
      {error && <p className="mod-error">{error}</p>}

      <form className="panel-card form-grid" onSubmit={submit}>
        <h3 className="full" style={{ margin: 0 }}>
          Nueva asignación de sector
        </h3>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Agente
          <select
            required
            value={form.agente}
            onChange={(e) => setForm({ ...form, agente: e.target.value })}
          >
            <option value="">Seleccione...</option>
            {(meta.agentes || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
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
          <input
            required
            value={form.cuadrante}
            onChange={(e) => setForm({ ...form, cuadrante: e.target.value })}
            placeholder="Cuadrante C-12"
          />
        </label>
        <label className="full">
          Detalle de ruta / cuadras
          <input
            value={form.sector_detalle}
            onChange={(e) => setForm({ ...form, sector_detalle: e.target.value })}
            placeholder="Av. 10 de Agosto entre Colón y Patria"
          />
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="map" />
            Asignar sector
          </button>
          <button type="button" className="btn-ghost" style={{ marginLeft: 8 }} onClick={() => load(fecha)}>
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
                <th>Agente</th>
                <th>Cuadrante</th>
                <th>Sector / ruta</th>
                <th>Zona</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{a.agente_info?.nombre}</td>
                  <td>{a.cuadrante}</td>
                  <td>{a.sector_detalle || "—"}</td>
                  <td>{a.zona_nombre || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        const sector = window.prompt("Actualizar detalle de ruta", a.sector_detalle || "");
                        if (sector != null) updateSector(a.id, { sector_detalle: sector });
                      }}
                    >
                      Editar ruta
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="mod-muted">
                    Sin asignaciones de sector.
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
