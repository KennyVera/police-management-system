function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC");
  } catch {
    return dt;
  }
}

export default function PartesHistorialLista({ items }) {
  if (!items.length) {
    return <p className="mod-muted">Aún no hay partes aprobados o rechazados.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Nº caso</th>
          <th>Agente</th>
          <th>Título</th>
          <th>Estado</th>
          <th>Revisor</th>
          <th>Actualizado</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id}>
            <td>{p.numero_caso || p.id}</td>
            <td>{p.agente}</td>
            <td>{p.titulo || "—"}</td>
            <td>
              <span
                className={`badge-estado ${
                  p.estado_revision === "APROBADO"
                    ? "ACTIVO"
                    : p.estado_revision === "OBSERVADO"
                      ? "BAJA"
                      : "SUSPENDIDO"
                }`}
              >
                {p.estado_revision_label || p.estado_revision}
              </span>
            </td>
            <td>{p.revisado_por_nombre || "—"}</td>
            <td>{fmt(p.aprobado_en || p.rechazado_en || p.actualizado_en)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
