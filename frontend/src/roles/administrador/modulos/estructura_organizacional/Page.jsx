import { useEffect, useState } from "react";
import { estructuraApi } from "../../api";
import JurisdiccionesPanel from "./componentes/JurisdiccionesPanel";
import DepartamentosPanel from "./componentes/DepartamentosPanel";
import AsignacionPlazasPanel from "./componentes/AsignacionPlazasPanel";
import "../identidad_accesos/IdentidadAccesos.css";

const META = {
  jurisdicciones: {
    title: "Jurisdicciones",
    desc: "Crear, editar o inactivar Zonas, Subzonas, Distritos, Circuitos y Subcircuitos.",
  },
  departamentos: {
    title: "Departamentos",
    desc: "Unidades especializadas según órdenes de la Comandancia (DINASED, Cibercrimen, etc.).",
  },
  plazas: {
    title: "Asignación de plazas",
    desc: "Vincular policías a un departamento y a una jurisdicción geográfica.",
  },
};

export default function EstructuraOrganizacionalPage({ section = "jurisdicciones" }) {
  const meta = META[section] || META.jurisdicciones;
  const [tipos, setTipos] = useState([]);
  const [jurisdicciones, setJurisdicciones] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [cat, jurs, deps] = await Promise.all([
        estructuraApi.catalogos(),
        estructuraApi.listJurisdicciones(),
        estructuraApi.listDepartamentos(),
      ]);
      setTipos(cat.tipos_jurisdiccion || []);
      setJurisdicciones(jurs);
      setDepartamentos(deps);
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
          <p className="mod-kicker">Estructura Organizacional</p>
          <h2>{meta.title}</h2>
          <p className="mod-desc">{meta.desc}</p>
        </div>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <>
          {section === "jurisdicciones" && (
            <JurisdiccionesPanel
              tipos={tipos}
              items={jurisdicciones}
              onChanged={load}
            />
          )}
          {section === "departamentos" && (
            <DepartamentosPanel items={departamentos} onChanged={load} />
          )}
          {section === "plazas" && (
            <AsignacionPlazasPanel
              departamentos={departamentos.filter((d) => d.activo)}
              jurisdicciones={jurisdicciones.filter((j) => j.activo)}
            />
          )}
        </>
      )}
    </div>
  );
}
