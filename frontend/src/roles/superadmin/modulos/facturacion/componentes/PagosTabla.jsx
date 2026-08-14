import { money, fmtDateTime, pillClass } from "../utils";
import EmptyRow from "./EmptyRow";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function PagosTabla({ items, busyId, onConfirmar, onReembolso }) {
  return (
    <section className="panel-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Institución</th>
            <th>Monto</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Método</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!items.length && <EmptyRow cols={7} />}
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.institucion_nombre}</strong>
                <div className="mod-muted">{p.referencia || p.factura_numero || ""}</div>
              </td>
              <td>{money(p.monto)}</td>
              <td>{p.tipo}</td>
              <td><span className={`pill ${pillClass(p.estado)}`}>{p.estado}</span></td>
              <td>{p.metodo}</td>
              <td>{fmtDateTime(p.fecha_pago)}</td>
              <td>
                <div style={{ display: "flex", gap: 4 }}>
                  {p.estado === "PENDIENTE" && (
                    <button type="button" className="btn-ghost" title="Confirmar" disabled={busyId === p.id} onClick={() => onConfirmar(p)}>
                      <MaterialIcon name="check_circle" />
                    </button>
                  )}
                  {p.estado === "CONFIRMADO" && p.tipo === "PAGO" && (
                    <button type="button" className="btn-ghost" title="Reembolso" disabled={busyId === p.id} onClick={() => onReembolso(p)}>
                      <MaterialIcon name="undo" />
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
