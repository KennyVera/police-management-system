import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_LAT = -0.1807;
const DEFAULT_LNG = -78.4678;
const STREET_ZOOM = 15;

const pinIcon = L.divIcon({
  className: "auxilio-map-pin",
  html: '<span class="auxilio-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function parseCoords(latitud, longitud, fallback) {
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return fallback;
}

function ringContainsPoint(lat, lng, ring) {
  if (!ring?.length) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInZone(lat, lng, zonaMapa) {
  const cuadrantes = zonaMapa?.cuadrantes || [];
  return cuadrantes.some((c) => {
    const ring = c?.poligono?.coordinates?.[0];
    return ringContainsPoint(lat, lng, ring);
  });
}

function parseNominatimAddress(data) {
  const addr = data?.address || {};
  const calle = addr.road || addr.pedestrian || addr.footway || addr.path || addr.cycleway;
  const numero = addr.house_number;
  const barrio =
    addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.residential;
  const ciudad =
    addr.city || addr.county || addr.town || addr.village || addr.municipality || addr.parish;
  const provincia = addr.state || addr.region;

  const calleTxt = calle && numero ? `${calle} ${numero}` : calle;
  const direccion =
    [calleTxt, barrio, ciudad, provincia, addr.country === "Ecuador" ? "" : addr.country]
      .filter(Boolean)
      .join(", ") ||
    data?.display_name ||
    "";

  const referencia =
    addr.amenity ||
    addr.shop ||
    addr.building ||
    addr.landmark ||
    addr.tourism ||
    addr.office ||
    addr.leisure ||
    "";

  return { direccion, referencia, addr };
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
    `&addressdetails=1&zoom=18&accept-language=es`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es",
    },
  });
  if (!res.ok) throw new Error("No se pudo obtener la dirección");
  const data = await res.json();
  return parseNominatimAddress(data);
}

function MapRecenter({ position, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    map.flyTo(position, Math.max(map.getZoom(), STREET_ZOOM), { duration: 0.35 });
  }, [active, map, position]);
  return null;
}

function FitZone({ zonaMapa }) {
  const map = useMap();
  useEffect(() => {
    const b = zonaMapa?.bounds;
    if (!b) return;
    const bounds = L.latLngBounds(
      [b.south, b.west],
      [b.north, b.east]
    );
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
      map.setMaxBounds(bounds.pad(0.05));
    }
  }, [zonaMapa, map]);
  return null;
}

function ClickCapture({ onPick, zonaMapa }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DraggablePin({ position, onMove }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setLatLng(position);
  }, [position]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onMove(lat, lng);
        },
      }}
    />
  );
}

function ZoneLayer({ zonaMapa }) {
  const geojson = useMemo(() => {
    const features = (zonaMapa?.cuadrantes || []).map((c) => ({
      type: "Feature",
      properties: { nombre: c.nombre },
      geometry: c.poligono,
    }));
    if (!features.length) return null;
    return { type: "FeatureCollection", features };
  }, [zonaMapa]);

  if (!geojson) return null;

  return (
    <GeoJSON
      data={geojson}
      style={() => ({
        fillColor: "#7c5cbf",
        fillOpacity: 0.12,
        color: "#a78bfa",
        weight: 2,
        dashArray: "6 4",
      })}
    />
  );
}

export default function AuxilioMapaSelector({
  latitud,
  longitud,
  zonaMapa = null,
  onLocationSelect,
}) {
  const [resolving, setResolving] = useState(false);
  const [hint, setHint] = useState("");
  const [flyToPin, setFlyToPin] = useState(false);
  const geocodeTimer = useRef(null);

  const fallbackCenter = useMemo(() => {
    const c = zonaMapa?.centro;
    if (c?.lat != null && c?.lng != null) return [c.lat, c.lng];
    return [DEFAULT_LAT, DEFAULT_LNG];
  }, [zonaMapa]);

  const position = useMemo(
    () => parseCoords(latitud, longitud, fallbackCenter),
    [latitud, longitud, fallbackCenter]
  );

  useEffect(() => {
    const zona = zonaMapa?.zona || "su zona operativa";
    setHint(
      zonaMapa?.cuadrantes?.length
        ? `Solo puede ubicar incidentes dentro de ${zona}. Haga clic en el mapa o arrastre el pin.`
        : "Haz clic en el mapa o arrastra el pin para ubicar el incidente"
    );
  }, [zonaMapa]);

  const geocodeAt = useCallback(
    async (lat, lng) => {
      setResolving(true);
      setHint("Obteniendo dirección…");
      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);

      try {
        const geo = await reverseGeocode(lat, lng);
        onLocationSelect({
          latitud: latStr,
          longitud: lngStr,
          direccion: geo.direccion,
          referencia: geo.referencia || "",
        });
        setHint(geo.direccion ? "Ubicación confirmada" : "Coordenadas registradas");
      } catch {
        onLocationSelect({
          latitud: latStr,
          longitud: lngStr,
          direccion: `${latStr}, ${lngStr}`,
          referencia: "",
        });
        setHint("Coordenadas listas (dirección no disponible)");
      } finally {
        setResolving(false);
      }
    },
    [onLocationSelect]
  );

  const handlePick = useCallback(
    (lat, lng) => {
      if (zonaMapa?.cuadrantes?.length && !pointInZone(lat, lng, zonaMapa)) {
        setHint("Fuera de su zona operativa. Seleccione un punto dentro del área sombreada.");
        return;
      }

      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);
      onLocationSelect({ latitud: latStr, longitud: lngStr });
      setFlyToPin(true);

      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => {
        geocodeAt(lat, lng);
      }, 320);
    },
    [geocodeAt, onLocationSelect, zonaMapa]
  );

  useEffect(
    () => () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    },
    []
  );

  const mapZoom = zonaMapa?.zoom || STREET_ZOOM;

  return (
    <div className="auxilio-mapa-panel">
      <div className="auxilio-mapa-head">
        <h3>Ubicar en mapa — {zonaMapa?.zona || "Zona operativa"}</h3>
        <p>{resolving ? "Resolviendo dirección con Nominatim…" : hint}</p>
      </div>
      <div className="auxilio-mapa-canvas">
        <MapContainer
          center={fallbackCenter}
          zoom={mapZoom}
          minZoom={12}
          maxZoom={19}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitZone zonaMapa={zonaMapa} />
          <ZoneLayer zonaMapa={zonaMapa} />
          <MapRecenter position={position} active={flyToPin} />
          <ClickCapture onPick={handlePick} zonaMapa={zonaMapa} />
          <DraggablePin position={position} onMove={handlePick} />
        </MapContainer>
      </div>
    </div>
  );
}
