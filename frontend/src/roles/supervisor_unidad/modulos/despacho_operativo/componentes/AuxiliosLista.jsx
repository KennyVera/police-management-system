export default function AuxiliosLista({ title, items, empty, onAsignar }) {
  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {!items.length ? (
        <p className="mod-muted">{empty}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Alerta</th>
              <th>Origen</th>
              <th>Prioridad</th>
              <th>Dirección</th>
              <th>Escuadra</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.titulo}</strong>
                </td>
                <td>{a.origen}</td>
                <td>{a.prioridad_label || a.prioridad}</td>
                <td>{a.direccion}</td>
                <td>
                  {a.escuadra_info?.nombre ||
                    a.agente_info?.nombre ||
                    "Sin asignar"}
                </td>
                <td>
                  <span
                    className={`badge-estado ${
                      a.estado === "PENDIENTE"
                        ? "SUSPENDIDO"
                        : a.estado === "CERRADA" || a.estado === "CANCELADA"
                          ? "BAJA"
                          : "ACTIVO"
                    }`}
                  >
                    {a.estado_label || a.estado}
                  </span>
                </td>
                <td>
                  {onAsignar && a.estado === "PENDIENTE" && (
                    <div className="row-actions">
                      <button type="button" onClick={() => onAsignar(a)}>
                        Asignar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
