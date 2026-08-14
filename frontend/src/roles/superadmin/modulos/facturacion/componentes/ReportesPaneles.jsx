import { money } from "../utils";

function KpiGrid({ items }) {
  return (
    <div className="fact-kpis">
      {items.map((it) => (
        <article key={it.label}>
          <span>{it.label}</span>
          <strong>{it.value}</strong>
          {it.hint && <small>{it.hint}</small>}
        </article>
      ))}
    </div>
  );
}

function IncomeTable({ title, rows, nameKey }) {
  if (!rows?.length) return null;
  return (
    <section className="fact-panel">
      <h3 className="fact-section-title">{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[nameKey] || r.nombre || r.mes}>
              <td>{r[nameKey] || r.nombre || r.mes}</td>
              <td>{money(r.ingresos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ReporteDiarioPanel({ data }) {
  const k = data?.kpis || {};
  return (
    <KpiGrid
      items={[
        { label: "Ingresos del día", value: money(k.ingresos), hint: "Neto confirmado" },
        { label: "Pagos realizados", value: k.pagos_realizados ?? 0 },
        { label: "Facturas emitidas", value: k.facturas_emitidas ?? 0 },
        { label: "Facturas anuladas", value: k.facturas_anuladas ?? 0 },
        { label: "Pagos pendientes", value: k.pagos_pendientes ?? 0 },
        { label: "Vencimientos", value: k.vencimientos ?? 0 },
        { label: "Renovaciones", value: k.renovaciones ?? 0 },
      ]}
    />
  );
}

export function ReporteMensualPanel({ data }) {
  const k = data?.kpis || {};
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <KpiGrid
        items={[
          { label: "Ingresos totales", value: money(k.ingresos) },
          { label: "vs mes anterior", value: `${k.variacion_pct ?? 0}%` },
          { label: "Nuevas suscripciones", value: k.nuevas_suscripciones ?? 0 },
          { label: "Renovaciones", value: k.renovaciones ?? 0 },
          { label: "Cancelaciones", value: k.cancelaciones ?? 0 },
          { label: "Morosidad", value: money(k.morosidad) },
          { label: "Facturas emitidas", value: k.facturas_emitidas ?? 0 },
        ]}
      />
      <IncomeTable title="Ingresos por plan" rows={data?.por_plan} nameKey="plan" />
      <IncomeTable title="Ingresos por institución" rows={data?.por_institucion} nameKey="institucion" />
    </div>
  );
}

export function ReporteAnualPanel({ data }) {
  const k = data?.kpis || {};
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <KpiGrid
        items={[
          { label: "Ingresos acumulados", value: money(k.ingresos) },
          { label: "Renovaciones", value: k.renovaciones ?? 0 },
          { label: "Cancelaciones", value: k.cancelaciones ?? 0 },
          { label: "Morosidad", value: money(k.morosidad) },
          { label: "Crecimiento", value: `${k.crecimiento_pct ?? 0}%` },
        ]}
      />
      <IncomeTable title="Evolución mensual" rows={data?.evolucion_mensual} nameKey="mes" />
      <IncomeTable title="Ingresos por plan" rows={data?.por_plan} nameKey="plan" />
      <IncomeTable title="Ingresos por institución" rows={data?.por_institucion} nameKey="institucion" />
    </div>
  );
}
