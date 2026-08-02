import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "auxilio-map-pin",
  html: '<span class="auxilio-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, position]);
  return null;
}

function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
    `&addressdetails=1&zoom=18&accept-language=es`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("No se pudo obtener la dirección");
  const data = await res.json();
  const addr = data.address || {};
  const calle = [addr.road, addr.pedestrian, addr.footway, addr.path].find(Boolean);
  const numero = addr.house_number;
  const barrio = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
  const ciudad = addr.city || addr.town || addr.village || addr.municipality;
  const direccion =
    [calle && numero ? `${calle} ${numero}` : calle, barrio, ciudad].filter(Boolean).join(", ") ||
    data.display_name ||
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const referencia =
    addr.amenity ||
    addr.shop ||
    addr.building ||
    addr.landmark ||
    addr.tourism ||
    "";
  return { direccion, referencia };
}

export default function AuxilioMapaSelector({ latitud, longitud, onLocationSelect }) {
  const [resolving, setResolving] = useState(false);
  const [hint, setHint] = useState("Haz clic en el mapa para ubicar el incidente");

  const position = useMemo(() => {
    const lat = Number(latitud);
    const lng = Number(longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }, [latitud, longitud]);

  const center = position || [-0.1807, -78.4678];

  async function handlePick(lat, lng) {
    setResolving(true);
    setHint("Obteniendo dirección...");
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
      setHint("Ubicación seleccionada");
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
  }

  return (
    <div className="auxilio-mapa-panel">
      <div className="auxilio-mapa-head">
        <h3>Ubicar en mapa</h3>
        <p>{resolving ? "Resolviendo dirección..." : hint}</p>
      </div>
      <div className="auxilio-mapa-canvas">
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onPick={handlePick} />
          {position && (
            <>
              <Marker position={position} icon={pinIcon} />
              <Recenter position={position} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
