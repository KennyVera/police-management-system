export default function UnidadesLista({ unidades, selectedId, onSelect }) {
  if (!unidades?.length) {
    return (
      <p className="mod-muted">
        No hay patrullas en turno en tu zona para hoy.
      </p>
    );
  }

  return (
    <div className="monitoreo-lista">
      {unidades.map((u) => {
        const active = selectedId === u.id;
        const gps = u.latitud != null && u.longitud != null;
        const nombres =
          (u.agentes || []).map((a) => a?.nombre).filter(Boolean).join(" · ") ||
          u.agente?.nombre ||
          "—";
        const direccion =
          u.alerta_activa?.direccion ||
          [u.sector_detalle, u.cuadrante].filter(Boolean).join(" · ") ||
          "Sin dirección";
        return (
          <button
            key={u.id}
            type="button"
            className={`monitoreo-unidad ${active ? "is-active" : ""}`}
            onClick={() => onSelect(u)}
            title={gps ? "Ver en el mapa" : "Sin GPS"}
          >
            <div className="monitoreo-unidad-top">
              <strong>
                {u.escuadra
                  ? `${u.escuadra}${u.vehiculo_placa ? ` · ${u.vehiculo_placa}` : ""}`
                  : u.unidad_label || u.vehiculo_placa || "Unidad"}
              </strong>
              <span
                className={`badge-estado ${u.alerta_activa ? "SUSPENDIDO" : "ACTIVO"}`}
              >
                {u.alerta_activa ? u.alerta_activa.estado_label : "Patrullaje"}
              </span>
            </div>
            <p>{nombres}</p>
            <p className="mod-muted">
              {u.vehiculo_placa} · {u.cuadrante || "Sin cuadrante"}
              {!gps ? " · Sin GPS" : ""}
            </p>
            <p className="monitoreo-unidad-dir">📍 {direccion}</p>
            {u.alerta_activa && (
              <p className="monitoreo-alerta-line">{u.alerta_activa.titulo}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
