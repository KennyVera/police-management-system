import { useEffect, useState } from "react";
import { estructuraApi } from "../../api";
import JurisdiccionesPanel from "./componentes/JurisdiccionesPanel";
import AsignacionPlazasPanel from "./componentes/AsignacionPlazasPanel";
import "../identidad_accesos/IdentidadAccesos.css";
import "../../../../shared/components/PaginationBar.css";

const META = {
  jurisdicciones: {
    title: "Jurisdicciones",
    desc: "Gestionar zonas y ver el personal que trabaja en cada una.",
  },
  plazas: {
    title: "Asignación a zonas",
    desc: "Selecciona una zona, pasa usuarios sin asignar y confirma. Supervisores, detectives y agentes quedan bajo el Jefe de esa zona.",
  },
};

export default function EstructuraOrganizacionalPage({ section = "jurisdicciones" }) {
  const meta = META[section] || META.jurisdicciones;
  const [tipos, setTipos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [jurisdicciones, setJurisdicciones] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [cat, jurs] = await Promise.all([
        estructuraApi.catalogos(),
        estructuraApi.listJurisdicciones(),
      ]);
      setTipos(cat.tipos_jurisdiccion || []);
      setZonas(cat.zonas || []);
      setJurisdicciones(jurs);
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
          {section === "plazas" && (
            <AsignacionPlazasPanel zonas={zonas} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}
