import { money, fmtDate, pillClass } from "../utils";
import EmptyRow from "./EmptyRow";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function SuscripcionesTabla({ items, busyId, onRenovar, onPeriodo, onHistorial }) {
  return (
    <section className="panel-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Institución</th>
            <th>Plan</th>
            <th>Estado pago</th>
            <th>Vence</th>
            <th>Periodo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!items.length && <EmptyRow cols={6} text="Sin suscripciones facturables." />}
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.nombre_comercial}</strong>
                <div className="mod-muted">{s.ruc}</div>
              </td>
              <td>
                {s.plan_nombre || "—"}
                <div className="mod-muted">{money(s.precio)}/{s.periodo_facturacion === "ANUAL" ? "año" : "mes"}</div>
              </td>
              <td>
                <span className={`pill ${pillClass(s.estado_pago)}`}>
                  {s.estado_pago_label || s.estado_pago}
                </span>
              </td>
              <td>{fmtDate(s.fecha_renovacion)}</td>
              <td>
                {s.periodo_facturacion || "MENSUAL"}
                <div className="mod-muted">gracia {s.dias_gracia ?? 7}d</div>
              </td>
              <td>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button type="button" className="btn-ghost" title="Renovar" disabled={busyId === s.id} onClick={() => onRenovar(s)}>
                    <MaterialIcon name="autorenew" />
                  </button>
                  <button type="button" className="btn-ghost" title="Cambiar periodo" disabled={busyId === s.id} onClick={() => onPeriodo(s)}>
                    <MaterialIcon name="calendar_month" />
                  </button>
                  <button type="button" className="btn-ghost" title="Historial" disabled={busyId === s.id} onClick={() => onHistorial(s)}>
                    <MaterialIcon name="history" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
