import ConfigSectionForm from "./componentes/ConfigSectionForm";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

const FIELDS = [
  { key: "version_actual", label: "Versión actual" },
  { key: "modo_mantenimiento", label: "Modo mantenimiento", type: "checkbox" },
  {
    key: "mensaje_mantenimiento",
    label: "Mensaje de mantenimiento",
    type: "textarea",
  },
  { key: "terminos_url", label: "URL términos", full: true },
  { key: "privacidad_url", label: "URL privacidad", full: true },
];

export default function PlataformaPage() {
  return (
    <ConfigSectionForm
      seccion="plataforma"
      title="Plataforma"
      desc="Versión, mantenimiento y páginas legales."
      fields={FIELDS}
    />
  );
}
