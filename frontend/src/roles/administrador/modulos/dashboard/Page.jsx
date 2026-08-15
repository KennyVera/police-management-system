import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useAuth } from "../../../../auth/AuthContext";
import "./Dashboard.css";

const KPI = [
  {
    label: "Usuarios del sistema",
    value: "6",
    hint: "Roles de acceso activos",
    icon: "group",
    tone: "purple",
  },
  {
    label: "Módulos listos",
    value: "4",
    hint: "Dashboard · Usuarios · Config · Auditoría",
    icon: "widgets",
    tone: "blue",
  },
  {
    label: "Servicios OK",
    value: "100%",
    hint: "API y autenticación operativas",
    icon: "verified_user",
    tone: "green",
  },
  {
    label: "Disponibilidad",
    value: "99.98%",
    hint: "+ Todo en orden",
    icon: "monitoring",
    tone: "violet",
  },
];

const ACTIVITY = [
  { name: "Ana Técnica", detail: "Inicio de sesión administrador", tag: "ACTIVO", tone: "ok" },
  { name: "Seed demo", detail: "Usuarios de prueba sincronizados", tag: "LISTO", tone: "ok" },
  { name: "Configuración", detail: "Módulo pendiente de funcionalidad", tag: "PENDIENTE", tone: "warn" },
];

const ALERTS = [
  {
    icon: "info",
    tone: "info",
    title: "Identidad y Accesos",
    text: "Alta de funcionarios, roles, suspensión y sesiones disponibles.",
  },
  {
    icon: "check_circle",
    tone: "ok",
    title: "Estructura organizacional",
    text: "Jurisdicciones y asignación de personal a zonas.",
  },
  {
    icon: "confirmation_number",
    tone: "purple",
    title: "Siguiente paso",
    text: "Registrar policías y vincularlos a su zona de trabajo.",
  },
];

const CHART_POINTS = [28, 34, 32, 41, 48, 55];

export default function Page() {
  const { user } = useAuth();
  const name = user?.first_name || "Admin";

  const max = Math.max(...CHART_POINTS);
  const poly = CHART_POINTS.map((v, i) => {
    const x = (i / (CHART_POINTS.length - 1)) * 100;
    const y = 100 - (v / max) * 78 - 8;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="admin-dash">
      <div className="dash-top">
        <article className="welcome-card">
          <div className="welcome-copy">
            <h2>
              ¡Bienvenida, {name}! <span aria-hidden="true">👋</span>
            </h2>
            <p>Aquí tienes un resumen general del estado de la plataforma.</p>
            <div className="status-pill">
              <span className="pulse" />
              Sistema operativo y funcionando correctamente.
            </div>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="shield-glow">
              <MaterialIcon name="shield" filled />
            </div>
          </div>
        </article>

        <article className="platform-card">
          <div className="platform-head">
            <h3>Estado de la Plataforma</h3>
            <span className="tag-ok">+ Todo en orden</span>
          </div>
          <p className="platform-label">Disponibilidad</p>
          <p className="platform-value">99.98%</p>
          <div className="mini-bars" aria-hidden="true">
            {[40, 55, 48, 70, 62, 78, 66, 84, 72, 90].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </article>
      </div>

      <div className="kpi-grid">
        {KPI.map((item) => (
          <article key={item.label} className={`kpi-card tone-${item.tone}`}>
            <div>
              <p className="kpi-label">{item.label}</p>
              <p className="kpi-value">{item.value}</p>
              <p className="kpi-hint">{item.hint}</p>
            </div>
            <span className="kpi-icon">
              <MaterialIcon name={item.icon} />
            </span>
          </article>
        ))}
      </div>

      <div className="dash-mid">
        <article className="panel chart-panel">
          <div className="panel-head">
            <h3>Actividad del sistema</h3>
            <span className="chip-select">Últimos 6 meses</span>
          </div>
          <svg className="spark-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cbf" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#7c5cbf" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${poly} 100,100`} fill="url(#adminFill)" />
            <polyline
              points={poly}
              fill="none"
              stroke="#7c5cbf"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="chart-labels">
            <span>Feb</span>
            <span>Mar</span>
            <span>Abr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Actividad reciente</h3>
          </div>
          <ul className="inst-list">
            {ACTIVITY.map((row) => (
              <li key={row.name}>
                <span className="inst-avatar">
                  <MaterialIcon name="apartment" />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.detail}</span>
                </div>
                <em className={`badge ${row.tone}`}>{row.tag}</em>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Alertas y Notificaciones</h3>
          </div>
          <ul className="alert-list">
            {ALERTS.map((a) => (
              <li key={a.title}>
                <span className={`alert-ico ${a.tone}`}>
                  <MaterialIcon name={a.icon} />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
