import ConfigSectionForm from "./componentes/ConfigSectionForm";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

const FIELDS = [
  {
    key: "zona_horaria",
    label: "Zona horaria",
    type: "select",
    options: [
      { value: "America/Guayaquil", label: "America/Guayaquil (EC)" },
      { value: "America/Bogota", label: "America/Bogota" },
      { value: "America/Lima", label: "America/Lima" },
      { value: "America/Mexico_City", label: "America/Mexico_City" },
      { value: "UTC", label: "UTC" },
    ],
  },
  {
    key: "formato_fecha",
    label: "Formato de fecha",
    type: "select",
    options: [
      { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
      { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
      { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
    ],
  },
  {
    key: "formato_hora",
    label: "Formato de hora",
    type: "select",
    options: [
      { value: "HH:mm", label: "24h (HH:mm)" },
      { value: "hh:mm A", label: "12h (hh:mm A)" },
    ],
  },
  {
    key: "moneda",
    label: "Moneda",
    type: "select",
    options: [
      { value: "USD", label: "USD" },
      { value: "EUR", label: "EUR" },
      { value: "MXN", label: "MXN" },
      { value: "COP", label: "COP" },
      { value: "PEN", label: "PEN" },
    ],
  },
  {
    key: "idioma",
    label: "Idioma",
    type: "select",
    options: [
      { value: "es-EC", label: "Español (EC)" },
      { value: "es-MX", label: "Español (MX)" },
      { value: "es-CO", label: "Español (CO)" },
      { value: "en-US", label: "English (US)" },
    ],
  },
];

export default function RegionalPage() {
  return (
    <ConfigSectionForm
      seccion="regional"
      title="Configuración regional"
      desc="Zona horaria, formatos, moneda e idioma."
      fields={FIELDS}
    />
  );
}
