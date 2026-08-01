import MaterialIcon from "../../../../../shared/components/MaterialIcon";

function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dt;
  }
}

export default function AlertaCard({ alerta, busy, onEnCamino, onLlegada, onCerrar }) {
  const prioridad = (alerta.prioridad || "MEDIA").toLowerCase();
  const estado = alerta.estado;
  const activa = ["ASIGNADA", "EN_CAMINO", "EN_LUGAR"].includes(estado);

  return (
    <article className={`alerta-card prioridad-${prioridad} estado-${estado.toLowerCase()}`}>
      <div className="alerta-top">
        <div className="alerta-origen">
          <MaterialIcon name="emergency" />
          <span>{alerta.origen || "ECU-911"}</span>
        </div>
        <span className={`badge-prio ${prioridad}`}>{alerta.prioridad_label}</span>
      </div>

      <h3>{alerta.titulo}</h3>
      <p className="alerta-dir">
        <MaterialIcon name="location_on" />
        {alerta.direccion}
      </p>
      {alerta.referencia && <p className="alerta-ref">{alerta.referencia}</p>}
      {alerta.descripcion && <p className="alerta-desc">{alerta.descripcion}</p>}

      <div className="alerta-meta">
        <span>
          <MaterialIcon name="schedule" />
          Asignada {fmt(alerta.asignada_en)}
        </span>
        <span className={`badge-estado-alerta ${estado}`}>{alerta.estado_label}</span>
      </div>

      {alerta.supervisor?.nombre && (
        <p className="alerta-sup">Supervisor: {alerta.supervisor.nombre}</p>
      )}

      {activa && (
        <div className="alerta-actions">
          {estado === "ASIGNADA" && (
            <button
              type="button"
              className="btn-accent"
              disabled={busy}
              onClick={onEnCamino}
            >
              <MaterialIcon name="directions_car" />
              En camino
            </button>
          )}
          {(estado === "ASIGNADA" || estado === "EN_CAMINO") && (
            <button
              type="button"
              className="btn-llegada"
              disabled={busy}
              onClick={onLlegada}
            >
              <MaterialIcon name="place" />
              Llegada al lugar
            </button>
          )}
          {(estado === "EN_CAMINO" || estado === "EN_LUGAR") && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={onCerrar}
            >
              <MaterialIcon name="check_circle" />
              Cerrar alerta
            </button>
          )}
        </div>
      )}

      {(alerta.en_camino_en || alerta.llegada_en) && (
        <div className="alerta-timeline">
          {alerta.en_camino_en && <span>En camino: {fmt(alerta.en_camino_en)}</span>}
          {alerta.llegada_en && <span>Llegada: {fmt(alerta.llegada_en)}</span>}
        </div>
      )}
    </article>
  );
}
