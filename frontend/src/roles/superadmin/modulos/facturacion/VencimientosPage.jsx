import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import { fmtDate, pillClass, money } from "./utils";
import EmptyRow from "./componentes/EmptyRow";
import ModalShell from "./componentes/ModalShell";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";

function Lista({ items, onGracia }) {
  return (
    <section className="panel-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Institución</th>
            <th>Plan</th>
            <th>Estado</th>
            <th>Vence</th>
            <th>Gracia</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!items.length && <EmptyRow cols={6} />}
          {items.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.nombre_comercial}</strong></td>
              <td>{s.plan_nombre}<div className="mod-muted">{money(s.precio)}</div></td>
              <td><span className={`pill ${pillClass(s.estado_pago)}`}>{s.estado_pago}</span></td>
              <td>{fmtDate(s.fecha_renovacion)}</td>
              <td>{s.dias_gracia ?? 7} días</td>
              <td>
                <button type="button" className="btn-ghost" onClick={() => onGracia(s)}>
                  <MaterialIcon name="hourglass_top" /> Gracia
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function VencimientosPage() {
  const [tab, setTab] = useState("proximos");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gracia, setGracia] = useState(null);
  const [dias, setDias] = useState(7);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const map = {
        proximos: facturacionApi.vencProximos,
        vencidas: facturacionApi.vencVencidas,
        alertas: facturacionApi.vencAlertas,
        historial: facturacionApi.vencHistorial,
      };
      const data = await map[tab]();
      setItems(data.items || data.suscripciones || data.historial || data.alertas || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function saveGracia() {
    try {
      await facturacionApi.setGracia(gracia.id, { dias_gracia: Number(dias) });
      setGracia(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="mod-page">
      <FacturacionHeader title="Vencimientos" desc="Próximos, vencidos, alertas y periodo de gracia.">
        <button type="button" className="btn-ghost" onClick={load}><MaterialIcon name="refresh" /> Actualizar</button>
      </FacturacionHeader>
      <div className="mod-tabs">
        {[
          ["proximos", "Próximos"],
          ["vencidas", "Vencidas"],
          ["alertas", "Alertas"],
          ["historial", "Historial"],
        ].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {error && <p className="mod-error">{error}</p>}
      {loading ? <p className="mod-muted">Cargando…</p> : (
        tab === "historial" ? (
          <section className="panel-card">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Institución</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>
                {!items.length && <EmptyRow cols={4} />}
                {items.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.creado_en)}</td>
                    <td>{e.institucion_nombre}</td>
                    <td>{e.accion}</td>
                    <td className="mod-muted">{e.detalle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <Lista items={items} onGracia={(s) => { setDias(s.dias_gracia ?? 7); setGracia(s); }} />
        )
      )}
      {gracia && (
        <ModalShell title="Periodo de gracia" subtitle={gracia.nombre_comercial} onClose={() => setGracia(null)}>
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            Días de gracia
            <input type="number" min={0} max={60} value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setGracia(null)}>Cancelar</button>
            <button type="button" className="btn-accent" onClick={saveGracia}>Guardar</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
