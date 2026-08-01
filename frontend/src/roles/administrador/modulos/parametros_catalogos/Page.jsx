import { useEffect, useState } from "react";
import { catalogosApi } from "../../api";
import TiposDelitosPanel from "./componentes/TiposDelitosPanel";
import CatalogosOperativosPanel from "./componentes/CatalogosOperativosPanel";
import VariablesGlobalesPanel from "./componentes/VariablesGlobalesPanel";
import "../identidad_accesos/IdentidadAccesos.css";

const META = {
  tipos_delito: {
    title: "Tipos de Delitos",
    desc: "Agregar y mantener el catálogo de delitos según el código penal.",
  },
  catalogos_operativos: {
    title: "Catálogos Operativos",
    desc: "Listas estáticas: marcas de vehículos, tipos de armas, colores, drogas, etc.",
  },
  variables_globales: {
    title: "Variables Globales",
    desc: "Tiempo de inactividad de sesión, peso máximo de archivos MinIO y más.",
  },
};

export default function ParametrosCatalogosPage({ section = "tipos_delito" }) {
  const meta = META[section] || META.tipos_delito;
  const [tiposCatalogo, setTiposCatalogo] = useState([]);
  const [delitos, setDelitos] = useState([]);
  const [operativos, setOperativos] = useState([]);
  const [variables, setVariables] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (section === "tipos_delito") {
        setDelitos(await catalogosApi.listDelitos());
      } else if (section === "catalogos_operativos") {
        const [metaRes, items] = await Promise.all([
          catalogosApi.meta(),
          catalogosApi.listOperativos(),
        ]);
        setTiposCatalogo(metaRes.tipos_catalogo_operativo || []);
        setOperativos(items);
      } else {
        setVariables(await catalogosApi.listVariables());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [section]);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Parámetros y Catálogos</p>
          <h2>{meta.title}</h2>
          <p className="mod-desc">{meta.desc}</p>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <>
          {section === "tipos_delito" && (
            <TiposDelitosPanel items={delitos} onChanged={load} />
          )}
          {section === "catalogos_operativos" && (
            <CatalogosOperativosPanel
              tipos={tiposCatalogo}
              items={operativos}
              onChanged={load}
            />
          )}
          {section === "variables_globales" && (
            <VariablesGlobalesPanel items={variables} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}
