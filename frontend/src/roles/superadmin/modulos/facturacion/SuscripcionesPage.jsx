import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import SuscripcionesTabla from "./componentes/SuscripcionesTabla";
import { RenovarModal, PeriodoModal } from "./componentes/SuscripcionModales";
import ModalShell from "./componentes/ModalShell";
import { fmtDateTime } from "./utils";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

export default function SuscripcionesFactPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [renovar, setRenovar] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [hist, setHist] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await facturacionApi.suscripciones();
      setItems(data.suscripciones || data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function doRenovar(meses) {
    setBusyId(renovar.id);
    try {
      await facturacionApi.renovar(renovar.id, { meses });
      setRenovar(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function doPeriodo(periodo_facturacion) {
    setBusyId(periodo.id);
    try {
      await facturacionApi.periodo(periodo.id, { periodo_facturacion });
      setPeriodo(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function openHist(row) {
    setBusyId(row.id);
    try {
      setHist(await facturacionApi.suscripcionHistorial(row.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mod-page">
      <FacturacionHeader
        title="Suscripciones"
        desc="Estado de pago, vencimientos, renovaciones y periodo de facturación."
      >
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" /> Actualizar
        </button>
      </FacturacionHeader>
      {error && <p className="mod-error">{error}</p>}
      {loading ? <p className="mod-muted">Cargando…</p> : (
        <SuscripcionesTabla
          items={items}
          busyId={busyId}
          onRenovar={setRenovar}
          onPeriodo={setPeriodo}
          onHistorial={openHist}
        />
      )}
      {renovar && <RenovarModal row={renovar} onClose={() => setRenovar(null)} onSubmit={doRenovar} />}
      {periodo && <PeriodoModal row={periodo} onClose={() => setPeriodo(null)} onSubmit={doPeriodo} />}
      {hist && (
        <ModalShell title="Historial de facturación" subtitle={hist.institucion?.nombre_comercial} onClose={() => setHist(null)} wide>
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {(hist.historial || hist.eventos || []).map((e) => (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.creado_en)}</td>
                  <td>{e.accion_label || e.accion}</td>
                  <td className="mod-muted">{e.detalle || e.nota || "—"}</td>
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
