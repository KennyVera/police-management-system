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
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => {
          const active = selectedId === p.id;
          return (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              className={active ? "is-selected" : ""}
              style={{ cursor: "pointer" }}
            >
              <td>{p.numero_caso || p.id}</td>
              <td>{p.agente}</td>
              <td>{p.titulo || "—"}</td>
              <td>{p.prioridad || "—"}</td>
              <td>{fmt(p.enviado_revision_en)}</td>
              <td>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: "0.25rem 0.55rem", fontSize: "0.82rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(p);
                  }}
                >
                  Revisar
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
