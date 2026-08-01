function fmtSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC");
  } catch {
    return dt;
  }
}

export default function MultimediaLista({ items }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">
          No hay evidencias subidas. Usa “Subir evidencia” para enviar fotos a MinIO.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Vista</th>
            <th>Archivo</th>
            <th>Origen</th>
            <th>Tamaño</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const isImage = (row.content_type || "").startsWith("image/");
            return (
              <tr key={row.id}>
                <td>
                  {isImage && row.url ? (
                    <img
                      src={row.url}
                      alt={row.nombre_archivo}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #e8ecf3",
                      }}
                    />
                  ) : (
                    <span className="mod-muted">archivo</span>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.nombre_archivo}</div>
                  <div className="mod-muted" style={{ fontSize: "0.78rem" }}>
                    {row.descripcion || row.object_key}
                  </div>
                </td>
                <td>{row.origen}</td>
                <td>{fmtSize(row.tamanio_bytes)}</td>
                <td>{fmt(row.creado_en)}</td>
                <td>
                  {row.url && (
                    <div className="row-actions">
                      <a href={row.url} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
