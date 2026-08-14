import ConfigSectionForm from "./componentes/ConfigSectionForm";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Configuracion.css";

const FIELDS = [
  { key: "nombre_sistema", label: "Nombre del sistema" },
  { key: "nombre_comercial", label: "Nombre comercial" },
  { key: "favicon_url", label: "Icono / favicon", type: "image" },
  { key: "logo_url", label: "Logotipo", type: "image" },
  { key: "descripcion", label: "Descripción de la plataforma", type: "textarea" },
  { key: "empresa_nombre", label: "Empresa" },
  { key: "empresa_ruc", label: "RUC / ID fiscal" },
  { key: "empresa_telefono", label: "Teléfono" },
  { key: "empresa_web", label: "Sitio web" },
  { key: "empresa_direccion", label: "Dirección", full: true },
];

export default function IdentidadPage() {
  return (
    <ConfigSectionForm
      seccion="identidad"
      title="Identidad de la plataforma"
      desc="Nombre, logos (MinIO) e información de la empresa."
      fields={FIELDS}
    />
  );
}
