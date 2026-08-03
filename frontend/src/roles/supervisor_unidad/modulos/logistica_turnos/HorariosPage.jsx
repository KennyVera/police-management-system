import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { localISODate } from "../../../../shared/utils/date";
import { supervisorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

export default function HorariosPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ agentes: [], tipos_horario: [] });
  const [form, setForm] = useState({
    agente: "",
    fecha: localISODate(),
    tipo: "FORMACION",
    detalle: "",
    hora_formacion: "07:00",
    hora_salida: "07:15",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        supervisorApi.listHorarios(),
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
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await supervisorApi.createHorario({
        ...form,
        agente: Number(form.agente),
        hora_formacion: form.hora_formacion ? `${form.hora_formacion}:00` : null,
        hora_salida: form.hora_salida ? `${form.hora_salida}:00` : null,
        estado: "PENDIENTE",
      });
      setForm({
        ...form,
        detalle: "",
        agente: "",
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function decidir(id, accion) {
    const respuesta =
      window.prompt(
        accion === "APROBAR" ? "Comentario de aprobación (opcional)" : "Motivo de rechazo"
      ) || "";
    try {
      await supervisorApi.decidirHorario(id, { accion, respuesta });
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
          <h2>Horarios y Novedades</h2>
          <p className="mod-desc">
            Aprueba cambios de turno, registra formación/salida y gestiona permisos o
            ausencias cortas.
          </p>
        </div>
      </header>
      {error && <p className="mod-error">{error}</p>}

      <form className="panel-card form-grid" onSubmit={submit}>
        <h3 className="full" style={{ margin: 0 }}>
          Registrar novedad / horario
        </h3>
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
          Tipo
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {(meta.tipos_horario || []).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
        </label>
        <label>
          Hora formación
          <input
            type="time"
            value={form.hora_formacion}
            onChange={(e) => setForm({ ...form, hora_formacion: e.target.value })}
          />
        </label>
        <label>
          Hora salida
          <input
            type="time"
            value={form.hora_salida}
            onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
          />
        </label>
        <label className="full">
          Detalle
          <textarea
            required
            rows={2}
            value={form.detalle}
            onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
          />
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="add" />
            Registrar
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
                <th>Fecha</th>
                <th>Agente</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id}>
                  <td>{h.fecha}</td>
                  <td>{h.agente_info?.nombre}</td>
                  <td>{h.tipo_label}</td>
                  <td>{h.detalle}</td>
                  <td>
                    <span
                      className={`badge-estado ${
                        h.estado === "APROBADO"
                          ? "ACTIVO"
                          : h.estado === "RECHAZADO"
                            ? "BAJA"
                            : "SUSPENDIDO"
                      }`}
                    >
                      {h.estado_label}
                    </span>
                  </td>
                  <td>
                    {h.estado === "PENDIENTE" && (
                      <div className="row-actions">
                        <button type="button" onClick={() => decidir(h.id, "APROBAR")}>
                          Aprobar
                        </button>
                        <button type="button" onClick={() => decidir(h.id, "RECHAZAR")}>
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={6} className="mod-muted">
                    Sin registros de horario.
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
