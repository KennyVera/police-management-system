import {
  btnGhost,
  tableBase,
  tableBodyRow,
  tableHeadRow,
  tableWrap,
} from "../../../../../shared/ui/saas";

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
    <div className={tableWrap}>
      <table className={`${tableBase} data-table`}>
        <thead>
          <tr className={tableHeadRow}>
            <th className="px-3 py-2">Nº caso</th>
            <th className="px-3 py-2">Agente</th>
            <th className="px-3 py-2">Título</th>
            <th className="px-3 py-2">Prioridad</th>
            <th className="px-3 py-2">Enviado</th>
            <th className="px-3 py-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const active = selectedId === p.id;
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`${tableBodyRow} cursor-pointer ${active ? "is-selected bg-violet-500/10" : ""}`}
              >
                <td className="px-3 py-2.5">{p.numero_caso || p.id}</td>
                <td className="px-3 py-2.5">{p.agente}</td>
                <td className="px-3 py-2.5">{p.titulo || "—"}</td>
                <td className="px-3 py-2.5">{p.prioridad || "—"}</td>
                <td className="px-3 py-2.5">{fmt(p.enviado_revision_en)}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className={`${btnGhost} px-3 py-1 text-xs`}
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
    </div>
  );
}
