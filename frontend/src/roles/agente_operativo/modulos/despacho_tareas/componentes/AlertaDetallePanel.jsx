import MaterialIcon from "../../../../../shared/components/MaterialIcon";

const STEPS = [
  { key: "en_camino", label: "En camino", icon: "directions_car" },
  { key: "en_lugar", label: "En el lugar", icon: "place" },
  { key: "parte", label: "Parte", icon: "description" },
  { key: "completado", label: "Completado", icon: "check_circle" },
];

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

function etaArrival(minutos) {
  if (minutos == null) return "—";
  const d = new Date(Date.now() + minutos * 60000);
  return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

export default function AlertaDetallePanel({
  alerta,
  busy,
  onEnCamino,
  onLlegada,
  onAbrirParte,
}) {
  if (!alerta) {
    return (
      <aside className="alerta-detalle panel-card">
        <p className="mod-muted">Selecciona una alerta para ver la ruta y el progreso.</p>
      </aside>
    );
  }

  const p = alerta.progreso || {};
  const done = {
    en_camino: p.en_camino,
    en_lugar: p.en_lugar,
    parte: p.parte,
    completado: p.completado,
  };
  const current = p.paso_actual;

  return (
    <aside className="alerta-detalle panel-card">
      <div className="detalle-head">
        <p className="mod-kicker">{alerta.origen || "ECU-911"}</p>
        <h3>{alerta.titulo}</h3>
        <p className="detalle-time">{fmt(alerta.asignada_en)}</p>
      </div>

      <p className="detalle-dir">
        <MaterialIcon name="location_on" />
        {alerta.direccion}
      </p>
      {alerta.descripcion && <p className="mod-desc">{alerta.descripcion}</p>}

      <div className="nav-summary">
        <div>
          <span className="turno-label">Distancia</span>
          <strong>{alerta.distancia_km != null ? `${alerta.distancia_km} km` : "—"}</strong>
        </div>
        <div>
          <span className="turno-label">ETA</span>
          <strong>
            {alerta.eta_minutos != null
              ? `${alerta.eta_minutos} min · ${etaArrival(alerta.eta_minutos)}`
              : "—"}
          </strong>
        </div>
      </div>

      {alerta.estado === "ASIGNADA" && (
        <button type="button" className="btn-accent btn-block" disabled={busy} onClick={onEnCamino}>
          <MaterialIcon name="navigation" />
          Iniciar navegación
        </button>
      )}
      {alerta.estado === "EN_CAMINO" && (
        <button type="button" className="btn-llegada btn-block" disabled={busy} onClick={onLlegada}>
          <MaterialIcon name="place" />
          Llegada al lugar
        </button>
      )}
      {alerta.estado === "EN_LUGAR" && (
        <div className="btn-llegada btn-block arrived-pill">
          <MaterialIcon name="check" />
          En el lugar del incidente
        </div>
      )}

      <div className="progreso-box">
        <p className="turno-label">Progreso de la atención</p>
        <div className="progreso-steps">
          {STEPS.map((s, idx) => {
            const isDone = done[s.key];
            const isCurrent = current === s.key || (current === "asignada" && idx === 0 && !isDone);
            return (
              <div
                key={s.key}
                className={`prog-step${isDone ? " done" : ""}${isCurrent ? " current" : ""}`}
              >
                <span className="prog-icon">
                  <MaterialIcon name={s.icon} />
                </span>
                <span className="prog-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="parte-box">
        <p className="turno-label">Parte de servicio</p>
        <p className="mod-muted" style={{ margin: "0.25rem 0 0.65rem", fontSize: "0.85rem" }}>
          Disponible al marcar llegada al lugar. Luego envías el borrador a tu supervisor.
        </p>
        <button
          type="button"
          className="btn-ghost btn-block"
          disabled={!alerta.puede_abrir_parte || busy}
          onClick={onAbrirParte}
          title={
            alerta.puede_abrir_parte
              ? "Abrir formulario del parte"
              : "Debes marcar Llegada al lugar primero"
          }
        >
          <MaterialIcon name="description" />
          {alerta.parte ? "Continuar parte / ver borrador" : "Abrir formulario del parte"}
        </button>
        {alerta.parte && (
          <p className="parte-estado-hint">
            Estado: <strong>{alerta.parte.estado_revision_label}</strong>
          </p>
        )}
      </div>

      <div className="safety-note">
        <MaterialIcon name="info" />
        Prioriza tu seguridad y sigue el protocolo de la unidad antes de intervenir.
      </div>
    </aside>
  );
}
