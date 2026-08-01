function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC");
  } catch {
    return dt;
  }
}

export default function PartesPendientesLista({ items, selectedId, onSelect }) {
  if (!items.length) {
    return <p className="mod-muted">No hay partes pendientes de revisión.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Nº caso</th>
          <th>Agente</th>
          <th>Título</th>
          <th>Prioridad</th>
          <th>Enviado</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              cursor: "pointer",
              background: selectedId === p.id ? "#f5f0ff" : undefined,
            }}
          >
            <td>{p.numero_caso || p.id}</td>
            <td>{p.agente}</td>
            <td>{p.titulo || "—"}</td>
            <td>{p.prioridad || "—"}</td>
            <td>{fmt(p.enviado_revision_en)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
