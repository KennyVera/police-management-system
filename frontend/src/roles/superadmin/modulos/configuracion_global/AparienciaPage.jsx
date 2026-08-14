import ConfigSectionForm from "./componentes/ConfigSectionForm";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

const FIELDS = [
  { key: "color_principal", label: "Color principal", type: "color" },
  { key: "color_secundario", label: "Color secundario", type: "color" },
  { key: "logo_login_url", label: "Logo para inicio de sesión", type: "image" },
  { key: "logo_reportes_url", label: "Logo para reportes", type: "image" },
  {
    key: "personalizacion_visual",
    label: "Personalización visual",
    type: "textarea",
  },
];

export default function AparienciaPage() {
  return (
    <ConfigSectionForm
      seccion="apariencia"
      title="Apariencia"
      desc="Colores, logos (MinIO) y personalización visual."
      fields={FIELDS}
    />
  );
}
