import MaterialIcon from "../../../../../shared/components/MaterialIcon";

function fmtTime(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dt;
  }
}

export default function AlertasListaPanel({ alertas, selectedId, onSelect }) {
  if (!alertas.length) {
    return <p className="mod-muted">No hay alertas activas.</p>;
  }

  return (
    <div className="alertas-list">
      {alertas.map((a) => {
        const selected = a.id === selectedId;
        const prio = (a.prioridad || "MEDIA").toLowerCase();
        return (
          <button
            key={a.id}
            type="button"
            className={`alerta-row${selected ? " selected" : ""}`}
            onClick={() => onSelect(a)}
          >
            <span className={`alerta-bell prio-${prio}`}>
              <MaterialIcon name="notifications_active" />
            </span>
            <span className="alerta-row-body">
              <strong>{a.titulo}</strong>
              <span className="alerta-row-meta">
                {a.direccion}
                {" · "}
                {fmtTime(a.asignada_en)}
                {a.distancia_km != null ? ` · ${a.distancia_km} km` : ""}
              </span>
            </span>
            <span className={`badge-prio ${prio}`}>{a.prioridad_label || a.prioridad}</span>
            <span className="ver-ruta">Ver ruta</span>
          </button>
        );
      })}
    </div>
  );
}
