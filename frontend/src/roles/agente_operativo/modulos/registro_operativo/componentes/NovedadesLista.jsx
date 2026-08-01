function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC");
  } catch {
    return dt;
  }
}

export default function NovedadesLista({ items, onEdit }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">Aún no has registrado novedades e incidentes.</p>
      </div>
    );
  }

  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Lugar</th>
            <th>Detenidos</th>
            <th>Descripción</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{fmt(row.fecha_hora)}</td>
              <td>{row.tipo_label}</td>
              <td>{row.lugar}</td>
              <td>
                <span className={`badge-estado ${row.hubo_detenidos ? "SUSPENDIDO" : "ACTIVO"}`}>
                  {row.hubo_detenidos ? "Sí" : "No"}
                </span>
              </td>
              <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.descripcion}
              </td>
              <td>
                <div className="row-actions">
                  <button type="button" onClick={() => onEdit(row)}>
                    Editar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
