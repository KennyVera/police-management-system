import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DENSIDAD_CRIMEN_BY_PROV } from "../data/demoPanorama";

const MAINLAND_CENTER = [-1.65, -78.45];
const GALAPAGOS_CENTER = [-0.7, -90.5];

function getColor(densidad) {
  const d = Number(densidad) || 0;
  if (d > 80) return "#7f1d1d";
  if (d > 60) return "#b91c1c";
  if (d > 40) return "#ef4444";
  if (d > 20) return "#fca5a5";
  return "#fecaca";
}

/** Estilo coroplético según feature.properties.densidad_crimen */
export function style(feature) {
  const densidad = feature?.properties?.densidad_crimen ?? 0;
  return {
    fillColor: getColor(densidad),
    weight: 1.2,
    opacity: 1,
    color: "#ffffff",
    dashArray: "",
    fillOpacity: 0.82,
  };
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

const ALIASES = {
  "SANTO DOMINGO DE LOS TSACHILAS": "SANTO DOMINGO",
  "ZONAS NO DELIMITADAS": "ZONAS NO DELIMITADAS",
};

function enrichGeoJson(geojson) {
  if (!geojson?.features) return geojson;
  const densityIndex = Object.fromEntries(
    Object.entries(DENSIDAD_CRIMEN_BY_PROV).map(([k, v]) => [normalizeName(k), v])
  );
  return {
    ...geojson,
    features: geojson.features.map((f) => {
      const raw = f.properties?.nombre || f.properties?.dpa_despro || "";
      const nombre = normalizeName(raw);
      const alias = ALIASES[nombre] ? normalizeName(ALIASES[nombre]) : null;
      const densidad_crimen =
        densityIndex[nombre] ??
        densityIndex[alias] ??
        Math.min(95, Math.round((f.properties?.densidad || 40) / 3));
      return {
        ...f,
        properties: {
          ...f.properties,
          densidad_crimen,
        },
      };
    }),
  };
}

function FitMainland({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    const mainland = {
      type: "FeatureCollection",
      features: geojson.features.filter(
        (f) => !String(f.properties?.nombre || "").toUpperCase().includes("GALAP")
      ),
    };
    try {
      const layer = L.geoJSON(mainland);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 });
    } catch {
      map.setView(MAINLAND_CENTER, 6);
    }
  }, [geojson, map]);
  return null;
}

function MapControls() {
  const map = useMap();
  return (
    <div className="ve-map-controls">
      <button type="button" title="Acercar" onClick={() => map.zoomIn()}>
        <span className="material-symbols-outlined">add</span>
      </button>
      <button type="button" title="Alejar" onClick={() => map.zoomOut()}>
        <span className="material-symbols-outlined">remove</span>
      </button>
      <button
        type="button"
        title="Centrar"
        onClick={() => map.setView(MAINLAND_CENTER, 6)}
      >
        <span className="material-symbols-outlined">home</span>
      </button>
    </div>
  );
}

function ProvinceLayer({ data, onSelect }) {
  const geoJsonRef = useRef(null);

  const onEachFeature = (feature, layer) => {
    const nombre = feature.properties?.nombre || feature.properties?.dpa_despro || "Provincia";
    const dens = feature.properties?.densidad_crimen ?? 0;
    layer.bindTooltip(
      `<strong>${nombre}</strong><br/>Índice: ${dens}`,
      { sticky: true, className: "ve-map-tip" }
    );
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ weight: 2.5, color: "#1f2937", fillOpacity: 0.95 });
        l.bringToFront();
      },
      mouseout: (e) => {
        geoJsonRef.current?.resetStyle(e.target);
      },
      click: () => onSelect?.(feature),
    });
  };

  return (
    <GeoJSON
      ref={geoJsonRef}
      key={data.features?.length || 0}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

function tileUrl(isDark) {
  return isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
}

function MiniGalapagos({ data, isDark }) {
  const gal = useMemo(() => {
    if (!data?.features) return null;
    const features = data.features.filter((f) =>
      String(f.properties?.nombre || "").toUpperCase().includes("GALAP")
    );
    if (!features.length) return null;
    return { type: "FeatureCollection", features };
  }, [data]);

  if (!gal) return null;

  return (
    <div className="ve-map-inset" aria-label="Galápagos">
      <span className="ve-map-inset-label">Galápagos</span>
      <MapContainer
        center={GALAPAGOS_CENTER}
        zoom={6}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        className="ve-map-inset-inner"
      >
        <TileLayer url={tileUrl(isDark)} />
        <GeoJSON data={gal} style={style} />
      </MapContainer>
    </div>
  );
}

export default function MapaChoropleth({ geojson, isDark, onSelectProvince }) {
  const enriched = useMemo(() => enrichGeoJson(geojson), [geojson]);

  if (!enriched) {
    return (
      <div className="ve-map-loading">
        <span className="material-symbols-outlined">map</span>
        Cargando mapa de provincias…
      </div>
    );
  }

  return (
    <div className="ve-map-wrap">
      <MapContainer
        center={MAINLAND_CENTER}
        zoom={6}
        zoomControl={false}
        attributionControl={false}
        className="ve-map-main"
        scrollWheelZoom
      >
        <TileLayer
          url={tileUrl(isDark)}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FitMainland geojson={enriched} />
        <ProvinceLayer data={enriched} onSelect={onSelectProvince} />
        <MapControls />
      </MapContainer>
      <MiniGalapagos data={enriched} isDark={isDark} />
      <div className="ve-map-legend">
        <p>Índice de Criminalidad (Delitos por 100k hab.)</p>
        <ul>
          <li><i style={{ background: "#7f1d1d" }} /> Muy Alto</li>
          <li><i style={{ background: "#b91c1c" }} /> Alto</li>
          <li><i style={{ background: "#ef4444" }} /> Medio</li>
          <li><i style={{ background: "#fca5a5" }} /> Bajo</li>
          <li><i style={{ background: "#fecaca" }} /> Muy Bajo</li>
        </ul>
      </div>
      <p className="ve-map-hint">Haz clic en una provincia para ver el detalle por zona.</p>
    </div>
  );
}
