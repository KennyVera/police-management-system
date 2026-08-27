import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchProvinciasGeoJSON } from "../../../../../shared/geo/ecuadorProvincias";
import "./JurisdiccionesPanel.css";

const ASIGNACION_PATH = "/app/administrador/estructura_organizacional/plazas";
const MAINLAND_CENTER = [-1.65, -78.45];
const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/DE LOS TSACHILAS/g, "")
    .trim();
}

function titleCaseProvince(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function matchSubzona(items, feature) {
  const props = feature?.properties || {};
  const dpa = String(props.dpa_provin || "").padStart(2, "0");
  const idProv = String(props.id_prov || "");
  const nombre = normalizeName(props.dpa_despro || props.nombre);
  const subzonas = (items || []).filter((j) => j.tipo === "SUBZONA");
  return (
    subzonas.find((j) => j.codigo === `SZ-${dpa}`) ||
    subzonas.find((j) => j.codigo === `SZ-${idProv.padStart(2, "0")}`) ||
    subzonas.find((j) => normalizeName(j.nombre) === nombre) ||
    null
  );
}

function zonaLabel(items, sub) {
  if (!sub) return "Sin zona asignada";
  if (sub.parent_nombre) return sub.parent_nombre;
  const zona = (items || []).find((j) => j.tipo === "ZONA" && j.id === sub.parent_id);
  return zona?.nombre || "Sin zona asignada";
}

function shortZonaName(full) {
  const text = String(full || "");
  const hit = text.match(/Zona\s+\d+/i);
  return hit ? hit[0] : text.split("—")[0]?.trim() || text;
}

const centroidCache = new WeakMap();

function buildCentroidIndex(geojson) {
  if (!geojson?.features?.length) return [];
  const cached = centroidCache.get(geojson);
  if (cached) return cached;

  const rows = geojson.features
    .map((feature) => {
      const props = feature.properties || {};
      const rawName = props.dpa_despro || props.nombre || "";
      if (!rawName || /ZONAS NO DELIMITAD/i.test(rawName)) return null;

      try {
        const layer = L.geoJSON(feature);
        const center = layer.getBounds().getCenter();
        return {
          id: props.id_prov || rawName,
          center: [center.lat, center.lng],
          provincia: titleCaseProvince(rawName),
          feature,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  centroidCache.set(geojson, rows);
  return rows;
}

function buildLabelIndex(centroids, items) {
  return centroids.map((row) => {
    const sub = matchSubzona(items, row.feature);
    return {
      id: row.id,
      center: row.center,
      provincia: row.provincia,
      zona: shortZonaName(zonaLabel(items, sub)),
    };
  });
}

function FitMainland({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    const mainland = {
      type: "FeatureCollection",
      features: geojson.features.filter(
        (f) =>
          !String(f.properties?.nombre || f.properties?.dpa_despro || "")
            .toUpperCase()
            .includes("GALAP")
      ),
    };
    try {
      const layer = L.geoJSON(mainland);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    } catch {
      map.setView(MAINLAND_CENTER, 6);
    }
  }, [geojson, map]);
  return null;
}

function ProvinciaLabels({ labels }) {
  return labels.map((item) => (
    <Marker
      key={item.id}
      position={item.center}
      interactive={false}
      icon={L.divIcon({
        className: "jur-prov-label-marker",
        html: `<span class="jur-prov-name">${item.provincia}</span><span class="jur-zona-name">${item.zona}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      })}
    />
  ));
}

function ProvinciasLayer({ geojson, items, onAdministrar }) {
  const ref = useRef(null);

  const onEachFeature = (feature, layer) => {
    const nombre = feature.properties?.dpa_despro || feature.properties?.nombre || "Provincia";
    const idProv = feature.properties?.id_prov ?? "";
    const sub = matchSubzona(items, feature);
    const zona = zonaLabel(items, sub);
    const qs = new URLSearchParams();
    if (idProv !== "") qs.set("provincia_id", String(idProv));
    if (sub?.id) qs.set("jurisdiccion_id", String(sub.id));
    const path = `${ASIGNACION_PATH}?${qs.toString()}`;
    const jefe = sub?.jefe_zona?.nombre || "Sin jefe asignado";
    const personal = sub?.personal_count ?? 0;

    layer.bindPopup(
      `<div class="jur-map-popup">
        <strong>${nombre}</strong>
        <p class="jur-map-zona">${zona}</p>
        <p>${sub ? `${sub.codigo} · ${jefe} · ${personal} en mando` : "Provincia aún no vinculada al directorio"}</p>
        <button type="button" class="jur-map-cta" data-path="${path}">Administrar Personal</button>
      </div>`,
      { maxWidth: 300 }
    );

    layer.on({
      popupopen: (e) => {
        const root = e.popup.getElement();
        const btn = root?.querySelector(".jur-map-cta");
        if (!btn || btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const target = btn.getAttribute("data-path");
          if (target && onAdministrar) onAdministrar(target);
        });
      },
      mouseover: (e) => {
        e.target.setStyle({ weight: 2.4, fillOpacity: 0.55, color: "#c4b5fd" });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        ref.current?.resetStyle(e.target);
      },
    });
  };

  const style = () => ({
    fillColor: "#7c5cbf",
    fillOpacity: 0.32,
    color: "#a78bfa",
    weight: 1.2,
  });

  return (
    <GeoJSON ref={ref} data={geojson} style={style} onEachFeature={onEachFeature} />
  );
}

export default function JurisdiccionesMapa({ items = [], refreshing = false }) {
  const navigate = useNavigate();
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchProvinciasGeoJSON()
      .then((data) => {
        if (!cancelled) {
          setGeojson(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "No se pudo cargar el mapa.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const centroids = useMemo(
    () => (geojson ? buildCentroidIndex(geojson) : []),
    [geojson]
  );

  const labels = useMemo(
    () => (centroids.length ? buildLabelIndex(centroids, items) : []),
    [centroids, items]
  );

  const layerKey = useMemo(
    () => (items || []).map((j) => `${j.id}:${j.parent_id}:${j.personal_count}`).join("|"),
    [items]
  );

  function goAdministrar(pathWithQuery) {
    // Navegación SPA: evita recargar toda la app (Leaflet, auth, shell…).
    navigate(pathWithQuery);
  }

  return (
    <div className="jur-map-wrap h-[600px] overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-800/90 shadow-xl">
      {refreshing && <p className="jur-map-refresh">Actualizando mando…</p>}
      {error && <p className="jur-map-error">{error}</p>}
      {!geojson && !error && <p className="jur-map-error">Cargando mapa de Ecuador…</p>}
      {geojson && (
        <MapContainer
          center={MAINLAND_CENTER}
          zoom={6}
          minZoom={5}
          maxZoom={10}
          scrollWheelZoom
          className="jur-map-canvas h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={OSM_TILES}
          />
          <FitMainland geojson={geojson} />
          <ProvinciasLayer
            key={layerKey}
            geojson={geojson}
            items={items}
            onAdministrar={goAdministrar}
          />
          <ProvinciaLabels labels={labels} />
        </MapContainer>
      )}
    </div>
  );
}
