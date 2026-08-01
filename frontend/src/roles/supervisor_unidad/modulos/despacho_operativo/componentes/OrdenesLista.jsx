export default function OrdenesLista({ items, onDecidir }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">No hay órdenes registradas.</p>
      </div>
    );
  }

  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Título</th>
            <th>Agente</th>
            <th>Lugar</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id}>
              <td>{o.tipo_label}</td>
              <td>
                <strong>{o.titulo}</strong>
                <div className="mod-muted" style={{ fontSize: "0.82rem" }}>
                  {o.detalle}
                </div>
              </td>
              <td>{o.agente_info?.nombre}</td>
              <td>{o.lugar || "—"}</td>
              <td>{o.prioridad_label}</td>
              <td>
                <span
                  className={`badge-estado ${
                    o.estado === "COMPLETADA"
                      ? "ACTIVO"
                      : o.estado === "CANCELADA"
                        ? "BAJA"
                        : "SUSPENDIDO"
                  }`}
                >
                  {o.estado_label}
                </span>
              </td>
              <td>
                {["ASIGNADA", "EN_CURSO"].includes(o.estado) && (
                  <div className="row-actions">
                    {o.estado === "ASIGNADA" && (
                      <button type="button" onClick={() => onDecidir(o.id, "EN_CURSO")}>
                        En curso
                      </button>
                    )}
                    <button type="button" onClick={() => onDecidir(o.id, "COMPLETAR")}>
                      Completar
                    </button>
                    <button type="button" onClick={() => onDecidir(o.id, "CANCELAR")}>
                      Cancelar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
