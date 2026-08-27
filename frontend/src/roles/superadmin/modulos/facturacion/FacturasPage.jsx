import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import FacturasTabla from "./componentes/FacturasTabla";
import ModalShell from "./componentes/ModalShell";
import { fmtDateTime } from "./utils";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

export default function FacturasPage() {
  const [items, setItems] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [generar, setGenerar] = useState(false);
  const [instId, setInstId] = useState("");
  const [hist, setHist] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await facturacionApi.facturas();
      setItems(data.facturas || []);
      setInstituciones(data.instituciones || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function doGenerar() {
    if (!instId) return;
    try {
      await facturacionApi.generarFactura({ institucion_id: Number(instId) });
      setGenerar(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function anular(f) {
    const motivo = window.prompt("Motivo de anulación:");
    if (!motivo) return;
    setBusyId(f.id);
    try {
      await facturacionApi.anularFactura(f.id, { motivo });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function exportar(f) {
    try {
      await facturacionApi.exportarFactura(f.id, `${f.numero || "factura"}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function openHist(f) {
    setBusyId(f.id);
    try {
      setHist(await facturacionApi.facturaHistorial(f.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mod-page">
      <FacturacionHeader title="Facturas" desc="Generar, anular, exportar y ver historial de cambios.">
        <button type="button" className="btn-ghost" onClick={load}><MaterialIcon name="refresh" /> Actualizar</button>
        <button type="button" className="btn-accent" onClick={() => setGenerar(true)}>
          <MaterialIcon name="note_add" /> Generar factura
        </button>
      </FacturacionHeader>
      {error && <p className="mod-error">{error}</p>}
      {loading ? <p className="mod-muted">Cargando…</p> : (
        <FacturasTabla items={items} busyId={busyId} onAnular={anular} onExport={exportar} onHistorial={openHist} />
      )}
      {generar && (
        <ModalShell title="Generar factura" onClose={() => setGenerar(false)}>
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            Institución
            <select value={instId} onChange={(e) => setInstId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre_comercial}</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setGenerar(false)}>Cancelar</button>
            <button type="button" className="btn-accent" onClick={doGenerar}>Generar</button>
          </div>
        </ModalShell>
      )}
      {hist && (
        <ModalShell title={`Historial · ${hist.factura?.numero || ""}`} onClose={() => setHist(null)} wide>
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {(hist.historial || []).map((e) => (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.creado_en)}</td>
                  <td>{e.accion}</td>
                  <td className="mod-muted">{e.detalle || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setHist(null)}>Cerrar</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
