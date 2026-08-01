import MaterialIcon from "../../../../../shared/components/MaterialIcon";

function fmtTime(t) {
  if (!t) return "—";
  return String(t).slice(0, 5);
}

export default function TurnoResumen({ asignacion: a, fechaConsulta }) {
  const companero = a.companero_info;
  const supervisor = a.supervisor_info;

  return (
    <div className="turno-layout">
      <article className="turno-hero panel-card">
        <div className="turno-hero-copy">
          <p className="mod-kicker">Turno del {a.fecha || fechaConsulta}</p>
          <h3>{a.cuadrante}</h3>
          <p className="mod-desc">
            {a.zona_nombre
              ? `${a.zona_tipo || "Zona"}: ${a.zona_nombre}`
              : "Zona de patrullaje asignada por tu unidad"}
          </p>
          <div className="turno-horario">
            <MaterialIcon name="schedule" />
            {fmtTime(a.turno_inicio)} — {fmtTime(a.turno_fin)}
          </div>
        </div>
        <div className="turno-hero-icon">
          <MaterialIcon name="map" />
        </div>
      </article>

      <div className="turno-cards">
        <article className="turno-card panel-card">
          <div className="turno-card-icon">
            <MaterialIcon name="group" />
          </div>
          <div>
            <p className="turno-label">Compañero de patrulla</p>
            <h4>{companero?.nombre || "Sin compañero asignado"}</h4>
            {companero?.placa && <p className="mod-muted">Placa {companero.placa}</p>}
            {companero?.email && <p className="mod-muted">{companero.email}</p>}
          </div>
        </article>

        <article className="turno-card panel-card">
          <div className="turno-card-icon vehicle">
            <MaterialIcon name="local_shipping" />
          </div>
          <div>
            <p className="turno-label">Vehículo asignado</p>
            <h4>{a.vehiculo_placa}</h4>
            <p className="mod-muted">{a.vehiculo_tipo}</p>
          </div>
        </article>

        <article className="turno-card panel-card">
          <div className="turno-card-icon zone">
            <MaterialIcon name="explore" />
          </div>
          <div>
            <p className="turno-label">Cuadrante / zona</p>
            <h4>{a.cuadrante}</h4>
            <p className="mod-muted">{a.zona_nombre || "—"}</p>
          </div>
        </article>

        <article className="turno-card panel-card">
          <div className="turno-card-icon sup">
            <MaterialIcon name="supervisor_account" />
          </div>
          <div>
            <p className="turno-label">Supervisor de turno</p>
            <h4>{supervisor?.nombre || "—"}</h4>
            {supervisor?.email && <p className="mod-muted">{supervisor.email}</p>}
          </div>
        </article>
      </div>

      {a.observaciones && (
        <div className="panel-card">
          <p className="turno-label">Observaciones del turno</p>
          <p style={{ margin: "0.35rem 0 0" }}>{a.observaciones}</p>
        </div>
      )}
    </div>
  );
}
