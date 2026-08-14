import { money, fmtDate, pillClass } from "../utils";
import EmptyRow from "./EmptyRow";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function FacturasTabla({ items, busyId, onAnular, onExport, onHistorial }) {
  return (
    <section className="panel-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Institución</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Emisión</th>
            <th>Vence</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!items.length && <EmptyRow cols={7} />}
          {items.map((f) => (
            <tr key={f.id}>
              <td><strong>{f.numero}</strong></td>
              <td>
                {f.institucion_nombre}
                <div className="mod-muted">{f.plan_nombre}</div>
              </td>
              <td>{money(f.monto)}</td>
              <td><span className={`pill ${pillClass(f.estado)}`}>{f.estado}</span></td>
              <td>{fmtDate(f.fecha_emision)}</td>
              <td>{fmtDate(f.fecha_vencimiento)}</td>
              <td>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="btn-ghost" title="Exportar" disabled={busyId === f.id} onClick={() => onExport(f)}>
                    <MaterialIcon name="download" />
                  </button>
                  <button type="button" className="btn-ghost" title="Historial" disabled={busyId === f.id} onClick={() => onHistorial(f)}>
                    <MaterialIcon name="history" />
                  </button>
                  {f.estado !== "ANULADA" && f.estado !== "PAGADA" && (
                    <button type="button" className="btn-ghost" title="Anular" disabled={busyId === f.id} onClick={() => onAnular(f)}>
                      <MaterialIcon name="cancel" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
