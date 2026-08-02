export default function UnidadesLista({ unidades, selectedId, onSelect }) {
  if (!unidades?.length) {
    return <p className="mod-muted">No hay unidades en turno con asignación hoy.</p>;
  }

  return (
    <div className="monitoreo-lista">
      {unidades.map((u) => {
        const active = selectedId === u.id;
        const gps = u.latitud != null && u.longitud != null;
        return (
          <button
            key={u.id}
            type="button"
            className={`monitoreo-unidad ${active ? "is-active" : ""}`}
            onClick={() => onSelect(u)}
          >
            <div className="monitoreo-unidad-top">
              <strong>{u.unidad_label || u.vehiculo_placa || "Unidad"}</strong>
              <span
                className={`badge-estado ${u.alerta_activa ? "SUSPENDIDO" : "ACTIVO"}`}
              >
                {u.alerta_activa ? u.alerta_activa.estado_label : "Patrullaje"}
              </span>
            </div>
            <p>{u.agente?.nombre || "—"}</p>
            <p className="mod-muted">
              {u.vehiculo_placa} · {u.cuadrante || "Sin cuadrante"}
              {!gps ? " · Sin GPS" : ""}
            </p>
            {u.alerta_activa && (
              <p className="monitoreo-alerta-line">{u.alerta_activa.titulo}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
