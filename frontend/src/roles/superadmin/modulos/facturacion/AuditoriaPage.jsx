import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import EmptyRow from "./componentes/EmptyRow";
import ModalShell from "./componentes/ModalShell";
import { fmtDateTime } from "./utils";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Facturacion.css";

const ACCIONES = [
  "EMITIR_FACTURA",
  "ANULAR_FACTURA",
  "CONFIRMAR_PAGO",
  "REGISTRAR_PAGO",
  "REEMBOLSO",
  "RENOVAR",
  "CAMBIAR_PERIODO",
  "GRACIA",
];

export default function AuditoriaPage() {
  const [items, setItems] = useState([]);
  const [filtros, setFiltros] = useState({
    accion: "",
    desde: "",
    hasta: "",
    institucion_id: "",
  });
  const [instituciones, setInstituciones] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await facturacionApi.auditoria(filtros);
      setItems(data.eventos || data.historial || []);
      if (data.instituciones) setInstituciones(data.instituciones);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mod-page">
      <FacturacionHeader
        title="Auditoría financiera"
        desc="Acciones con filtros por institución, fecha y tipo de operación."
      >
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" /> Actualizar
        </button>
      </FacturacionHeader>

      <section className="fact-filters">
        <label>
          Institución
          <select
            value={filtros.institucion_id}
            onChange={(e) => setFiltros({ ...filtros, institucion_id: e.target.value })}
          >
            <option value="">Todas</option>
            {instituciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre_comercial}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acción
          <select
            value={filtros.accion}
            onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
          >
            <option value="">Todas</option>
            {ACCIONES.map((a) => (
              <option key={a} value={a}>
                {a.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
          />
        </label>
        <div className="fact-filters-actions">
          <button type="button" className="btn-accent" onClick={load}>
            Filtrar
          </button>
        </div>
      </section>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando…</p>
      ) : (
        <section className="fact-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Institución</th>
                <th>Acción</th>
                <th>Actor</th>
                <th>Detalle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!items.length && <EmptyRow cols={6} />}
              {items.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.creado_en)}</td>
                  <td>{e.institucion_nombre || "—"}</td>
                  <td>
                    <span className="fact-accion-chip">
                      {(e.accion || "").replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="mod-muted">{e.actor_email || e.actor_username || "—"}</td>
                  <td className="mod-muted">{(e.detalle || "").slice(0, 70)}</td>
                  <td>
                    <button type="button" className="btn-ghost" onClick={() => setDetalle(e)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {detalle && (
        <ModalShell title="Detalle del movimiento" onClose={() => setDetalle(null)}>
          <div className="fact-detail-grid">
            {[
              ["Fecha", fmtDateTime(detalle.creado_en)],
              ["Institución", detalle.institucion_nombre || "—"],
              ["Acción", detalle.accion],
              ["Actor", detalle.actor_email || detalle.actor_username || "—"],
              ["Entidad", `${detalle.entidad_tipo || "—"} #${detalle.entidad_id || "—"}`],
              ["Detalle", detalle.detalle || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
