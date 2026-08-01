import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useAuth } from "../../../../auth/AuthContext";
import { supervisorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../agente_operativo/modulos/dashboard/Dashboard.css";

export default function Page() {
  const { user } = useAuth();
  const name = user?.first_name || "Supervisor";
  const [stats, setStats] = useState({
    partes_pendientes: 0,
    escuadras_hoy: 0,
    asignaciones_hoy: 0,
    horarios_pendientes: 0,
  });

  useEffect(() => {
    supervisorApi
      .dashboard()
      .then((d) => setStats({ ...stats, ...(d.stats || {}) }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    {
      label: "Partes pendientes",
      value: String(stats.partes_pendientes || 0),
      hint: "Control de calidad",
      icon: "inbox",
      tone: "purple",
    },
    {
      label: "Escuadras hoy",
      value: String(stats.escuadras_hoy || 0),
      hint: "Grupos de patrulla",
      icon: "groups",
      tone: "blue",
    },
    {
      label: "Asignaciones",
      value: String(stats.asignaciones_hoy || 0),
      hint: "Vehículo / sector del día",
      icon: "local_shipping",
      tone: "green",
    },
    {
      label: "Horarios pendientes",
      value: String(stats.horarios_pendientes || 0),
      hint: "Cambios y permisos",
      icon: "event_available",
      tone: "violet",
    },
  ];

  return (
    <div className="admin-dash agente-dash">
      <div className="dash-top">
        <article className="welcome-card">
          <div className="welcome-copy">
            <h2>Hola, {name}</h2>
            <p>
              Organiza la logística diaria de tu unidad y revisa los partes de tus agentes
              antes de que salgan a Fiscalía.
            </p>
            <span className="status-pill">
              <span className="pulse" />
              Supervisión de unidad
            </span>
          </div>
          <div className="welcome-art">
            <div className="shield-glow">
              <MaterialIcon name="supervisor_account" />
            </div>
          </div>
        </article>
        <article className="platform-card">
          <h3>Tu día</h3>
          <p>Dos frentes: logística de turnos y control de calidad de partes.</p>
          <ul>
            <li>Escuadras, vehículos y sectores</li>
            <li>Horarios, formación y permisos</li>
            <li>Aprobar o devolver partes con comentario</li>
          </ul>
        </article>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <article key={k.label} className={`kpi-card tone-${k.tone}`}>
            <div className="kpi-icon">
              <MaterialIcon name={k.icon} />
            </div>
            <div>
              <p className="kpi-label">{k.label}</p>
              <p className="kpi-value">{k.value}</p>
              <p className="kpi-hint">{k.hint}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
