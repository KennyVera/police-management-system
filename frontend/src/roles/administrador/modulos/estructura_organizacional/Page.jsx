import { useCallback, useEffect, useState } from "react";
import { estructuraApi } from "../../api";
import JurisdiccionesPanel from "./componentes/JurisdiccionesPanel";
import AsignacionPlazasPanel from "./componentes/AsignacionPlazasPanel";
import {
  clearJurisdiccionesMapCache,
  readJurisdiccionesMapCache,
  refreshJurisdiccionesMapa,
  writeJurisdiccionesMapCache,
} from "../../../../shared/cache/jurisdiccionesMapCache";
import { fetchProvinciasGeoJSON } from "../../../../shared/geo/ecuadorProvincias";
import "../identidad_accesos/IdentidadAccesos.css";
import "../../../../shared/components/PaginationBar.css";

const META = {
  jurisdicciones: {
    title: "Jurisdicciones",
    desc: "Mapa de mando territorial: haga clic en una provincia para administrar el personal de esa subzona.",
  },
  plazas: {
    title: "Asignación a zonas",
    desc: "Centro de transferencias: mueva supervisores, detectives y agentes hacia el distrito o subzona pre-cargado.",
  },
};

export default function EstructuraOrganizacionalPage({ section = "jurisdicciones" }) {
  const meta = META[section] || META.jurisdicciones;
  const [jurisdicciones, setJurisdicciones] = useState(() =>
    section === "jurisdicciones" ? readJurisdiccionesMapCache() || [] : []
  );
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async ({ force = false } = {}) => {
    if (section === "plazas") return;

    setError("");
    const cached = !force ? readJurisdiccionesMapCache() : null;
    if (cached?.length) setJurisdicciones(cached);
    setRefreshing(true);

    try {
      if (force) clearJurisdiccionesMapCache();
      const jurs = await refreshJurisdiccionesMapa(() =>
        estructuraApi.listJurisdiccionesMapa()
      );
      setJurisdicciones(jurs);
      writeJurisdiccionesMapCache(jurs);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [section]);

  useEffect(() => {
    if (section === "jurisdicciones") {
      fetchProvinciasGeoJSON().catch(() => {});
    }
    load();
  }, [load, section]);

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
      {section === "jurisdicciones" && (
        <JurisdiccionesPanel
          items={jurisdicciones}
          refreshing={refreshing}
          onChanged={() => load({ force: true })}
        />
      )}
      {section === "plazas" && (
        <AsignacionPlazasPanel
          onChanged={() => {
            clearJurisdiccionesMapCache();
          }}
        />
      )}
    </div>
  );
}
