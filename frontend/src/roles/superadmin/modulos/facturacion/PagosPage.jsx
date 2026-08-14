import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import PagosTabla from "./componentes/PagosTabla";
import { RegistrarPagoModal, ReembolsoModal } from "./componentes/PagoModales";
import { fmtDateTime, money } from "./utils";
import ModalShell from "./componentes/ModalShell";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

export default function PagosPage() {
  const [tab, setTab] = useState("todos");
  const [items, setItems] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [registrar, setRegistrar] = useState(false);
  const [reembolso, setReembolso] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const estado =
        tab === "pendientes" ? "PENDIENTE" : tab === "vencidos" ? "VENCIDO" : undefined;
      const data = await facturacionApi.pagos({ estado });
      setItems(data.pagos || []);
      setInstituciones(data.instituciones || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function confirmar(p) {
    setBusyId(p.id);
    try {
      await facturacionApi.confirmarPago(p.id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function doRegistro(body) {
    try {
      await facturacionApi.registrarPago(body);
      setRegistrar(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function doReembolso(body) {
    setBusyId(reembolso.id);
    try {
      await facturacionApi.reembolso(reembolso.id, body);
      setReembolso(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function openTx() {
    try {
      setTx(await facturacionApi.transacciones());
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="mod-page">
      <FacturacionHeader title="Pagos" desc="Registrar, confirmar, pendientes, vencidos y reembolsos.">
        <button type="button" className="btn-ghost" onClick={openTx}>
          <MaterialIcon name="receipt" /> Historial
        </button>
        <button type="button" className="btn-accent" onClick={() => setRegistrar(true)}>
          <MaterialIcon name="add" /> Registrar pago
        </button>
      </FacturacionHeader>
      <div className="mod-tabs">
        {[
          ["todos", "Todos"],
          ["pendientes", "Pendientes"],
          ["vencidos", "Vencidos"],
        ].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {error && <p className="mod-error">{error}</p>}
      {loading ? <p className="mod-muted">Cargando…</p> : (
        <PagosTabla items={items} busyId={busyId} onConfirmar={confirmar} onReembolso={setReembolso} />
      )}
      {registrar && (
        <RegistrarPagoModal instituciones={instituciones} onClose={() => setRegistrar(false)} onSubmit={doRegistro} />
      )}
      {reembolso && <ReembolsoModal row={reembolso} onClose={() => setReembolso(null)} onSubmit={doReembolso} />}
      {tx && (
        <ModalShell title="Historial de transacciones" onClose={() => setTx(null)} wide>
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Institución</th><th>Tipo</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>
              {(tx.transacciones || tx.pagos || []).map((t) => (
                <tr key={t.id}>
                  <td>{fmtDateTime(t.fecha_pago || t.creado_en)}</td>
                  <td>{t.institucion_nombre}</td>
                  <td>{t.tipo}</td>
                  <td>{money(t.monto)}</td>
                  <td>{t.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setTx(null)}>Cerrar</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
