function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC");
  } catch {
    return dt;
  }
}

function estadoClass(estado) {
  if (estado === "BORRADOR") return "SUSPENDIDO";
  if (estado === "OBSERVADO") return "SUSPENDIDO";
  if (estado === "EN_REVISION") return "ACTIVO";
  if (estado === "APROBADO") return "ACTIVO";
  return "BAJA";
}

export default function PartesLista({ items, busyId, onConsult, onEdit, onEnviar }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">
          No hay partes registrados. Ábrelos desde una alerta al marcar “Llegada al lugar”.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nº caso</th>
            <th>Título</th>
            <th>Delito / IUCR</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.numero_caso || `P-${row.id}`}</td>
              <td>
                <div>{row.titulo || "—"}</div>
                <div className="mod-muted" style={{ fontSize: "0.78rem" }}>
                  {row.lugar}
                </div>
                {row.motivo_rechazo && row.estado_revision === "OBSERVADO" && (
                  <div style={{ color: "#b91c1c", fontSize: "0.78rem", marginTop: 4 }}>
                    Rechazo: {row.motivo_rechazo}
                  </div>
                )}
              </td>
              <td>
                <div>{row.tipo_delito_nombre || "—"}</div>
                <div className="mod-muted" style={{ fontSize: "0.78rem" }}>
                  {row.codigo_iucr ? `IUCR ${row.codigo_iucr}` : ""}
                  {row.clasificacion_fbi ? ` · ${row.clasificacion_fbi}` : ""}
                </div>
              </td>
              <td>
                <span className={`badge-estado ${estadoClass(row.estado_revision)}`}>
                  {row.estado_revision_label || row.estado_revision}
                </span>
                {row.bloqueado && (
                  <div className="mod-muted" style={{ fontSize: "0.72rem" }}>
                    Bloqueado · PDF
                  </div>
                )}
              </td>
              <td>
                <div className="row-actions">
                  <button type="button" onClick={() => onConsult(row)}>
                    Consultar
                  </button>
                  {row.puede_editar && (
                    <button type="button" onClick={() => onEdit(row)}>
                      Editar
                    </button>
                  )}
                  {row.puede_enviar && (
                    <button
                      type="button"
                      onClick={() => onEnviar(row)}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id
                        ? "Enviando..."
                        : row.estado_revision === "OBSERVADO"
                          ? "Reenviar a Supervisor"
                          : "Enviar a Supervisor"}
                    </button>
                  )}
                  {row.estado_revision === "APROBADO" && row.pdf_url && (
                    <a href={row.pdf_url} target="_blank" rel="noreferrer">
                      Descargar PDF
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
