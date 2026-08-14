import ConfigSectionForm from "./componentes/ConfigSectionForm";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

const FIELDS = [
  { key: "correo_remitente", label: "Correo remitente", type: "email" },
  { key: "nombre_remitente", label: "Nombre del remitente" },
  {
    key: "plantillas_correo",
    label: "Plantillas de correo (una por línea)",
    type: "textarea",
  },
  { key: "notificaciones_globales", label: "Notificaciones globales activas", type: "checkbox" },
  {
    key: "notificaciones_mensaje",
    label: "Mensaje de notificaciones globales",
    type: "textarea",
  },
];

function SmtpHint(form) {
  return (
    <>
      <p className="cfg-hint">
        Remitente del sistema: <strong>crimetracksoporte@gmail.com</strong>.
        La <strong>contraseña de aplicación</strong> no se guarda aquí: colócala
        manualmente en el archivo <code>.env</code> del proyecto como{" "}
        <code>EMAIL_HOST_PASSWORD=tu_app_password</code> y reinicia el backend.
        {" "}
        <span className={`cfg-badge ${form.smtp_password_configured ? "ok" : "warn"}`}>
          {form.smtp_password_configured ? "SMTP configurado" : "Falta EMAIL_HOST_PASSWORD"}
        </span>
      </p>
    </>
  );
}

export default function ComunicacionesPage() {
  return (
    <ConfigSectionForm
      seccion="comunicaciones"
      title="Comunicaciones"
      desc="Correo remitente, plantillas y notificaciones globales."
      fields={FIELDS}
      extra={SmtpHint}
    />
  );
}
