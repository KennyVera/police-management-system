export default function ReportesFiltros({
  value,
  onChange,
  planes = [],
  instituciones = [],
  nivel,
  onApply,
}) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <section className="fact-filters">
      {nivel === "diario" && (
        <label>
          Fecha
          <input
            type="date"
            value={value.fecha || ""}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </label>
      )}
      {nivel !== "diario" && (
        <label>
          Año
          <input
            type="number"
            value={value.anio || ""}
            onChange={(e) => set("anio", e.target.value)}
          />
        </label>
      )}
      {nivel === "mensual" && (
        <label>
          Mes
          <input
            type="number"
            min={1}
            max={12}
            value={value.mes || ""}
            onChange={(e) => set("mes", e.target.value)}
          />
        </label>
      )}
      <label>
        Institución
        <select
          value={value.institucion_id || ""}
          onChange={(e) => set("institucion_id", e.target.value)}
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
        Plan
        <select value={value.plan_id || ""} onChange={(e) => set("plan_id", e.target.value)}>
          <option value="">Todos</option>
          {planes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modalidad
        <select value={value.modalidad || ""} onChange={(e) => set("modalidad", e.target.value)}>
          <option value="">Todas</option>
          <option value="SAAS">SaaS</option>
          <option value="ON_PREMISE">On-Premise</option>
        </select>
      </label>
      <label>
        Método
        <select value={value.metodo || ""} onChange={(e) => set("metodo", e.target.value)}>
          <option value="">Todos</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
          <option value="orden_compra">Orden compra</option>
        </select>
      </label>
      <label>
        Estado
        <select value={value.estado || ""} onChange={(e) => set("estado", e.target.value)}>
          <option value="">Todos</option>
          <option value="CONFIRMADO">Confirmado</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EMITIDA">Emitida</option>
          <option value="ANULADA">Anulada</option>
        </select>
      </label>
      <div className="fact-filters-actions">
        <button type="button" className="btn-accent" onClick={onApply}>
          Aplicar filtros
        </button>
      </div>
    </section>
  );
}
