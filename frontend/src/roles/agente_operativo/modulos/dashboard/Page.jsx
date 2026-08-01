import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useAuth } from "../../../../auth/AuthContext";
import { agenteApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Dashboard.css";

export default function Page() {
  const { user } = useAuth();
  const name = user?.first_name || "Agente";
  const [stats, setStats] = useState({
    partes: 0,
    novedades: 0,
    multimedia: 0,
    alertas_activas: 0,
    tiene_turno_hoy: false,
  });

  useEffect(() => {
    agenteApi
      .dashboard()
      .then((d) => setStats({ ...stats, ...(d.stats || {}) }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    {
      label: "Alertas activas",
      value: String(stats.alertas_activas || 0),
      hint: "Despachos ECU-911 pendientes",
      icon: "emergency",
      tone: "purple",
    },
    {
      label: "Partes de aprehensión",
      value: String(stats.partes),
      hint: "Registrados por ti",
      icon: "person_off",
      tone: "blue",
    },
    {
      label: "Novedades",
      value: String(stats.novedades),
      hint: "Incidentes sin detención",
      icon: "report",
      tone: "green",
    },
    {
      label: "Mi turno",
      value: stats.tiene_turno_hoy ? "Asignado" : "—",
      hint: stats.tiene_turno_hoy ? "Vehículo y cuadrante listos" : "Sin asignación hoy",
      icon: "badge",
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
              Revisa tus alertas ECU-911 y tu asignación diaria (compañero, vehículo y
              cuadrante). Luego documenta en Registro Operativo.
            </p>
            <span className="status-pill">
              <span className="pulse" />
              En servicio urbano
            </span>
          </div>
          <div className="welcome-art">
            <div className="shield-glow">
              <MaterialIcon name="local_police" />
            </div>
          </div>
        </article>
        <article className="platform-card">
          <h3>Mi Turno</h3>
          <p>
            Despacho y tareas del día: emergencias asignadas y patrullaje con tu unidad.
          </p>
          <ul>
            <li>Alertas ECU-911 con En camino / Llegada</li>
            <li>Compañero, vehículo y cuadrante</li>
            <li>Registro operativo en calle</li>
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
