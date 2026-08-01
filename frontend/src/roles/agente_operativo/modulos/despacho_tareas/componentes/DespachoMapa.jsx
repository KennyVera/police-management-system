import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const unitIcon = L.divIcon({
  className: "map-pin-unit",
  html: '<span class="pin-dot unit"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const incidentIcon = L.divIcon({
  className: "map-pin-incident",
  html: '<span class="pin-dot incident"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

async function fetchRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("ruta");
  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!coords?.length) throw new Error("sin geometría");
  return coords.map(([lng, lat]) => [lat, lng]);
}

export default function DespachoMapa({ unidad, alerta }) {
  const unitPos = useMemo(() => {
    if (!unidad?.latitud || !unidad?.longitud) return null;
    return [Number(unidad.latitud), Number(unidad.longitud)];
  }, [unidad]);

  const incidentPos = useMemo(() => {
    if (!alerta?.latitud || !alerta?.longitud) return null;
    return [Number(alerta.latitud), Number(alerta.longitud)];
  }, [alerta]);

  const [route, setRoute] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setRoute([]);
    if (!unitPos || !incidentPos) return undefined;
    fetchRoute(unitPos, incidentPos)
      .then((pts) => {
        if (!cancelled) setRoute(pts);
      })
      .catch(() => {
        if (!cancelled) setRoute([unitPos, incidentPos]);
      });
    return () => {
      cancelled = true;
    };
  }, [unitPos, incidentPos]);

  const center = unitPos || incidentPos || [-0.1807, -78.4678];
  const boundsPts = [unitPos, incidentPos].filter(Boolean);

  const etaLabel =
    alerta?.eta_minutos != null && alerta?.distancia_km != null
      ? `${alerta.eta_minutos} min · ${alerta.distancia_km} km`
      : null;

  return (
    <div className="despacho-map-wrap">
      <MapContainer
        center={center}
        zoom={13}
        className="despacho-map"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPts} />
        {unitPos && (
          <Marker position={unitPos} icon={unitIcon}>
            <Popup>
              <strong>{unidad?.label || "Unidad"}</strong>
              {unidad?.vehiculo_placa ? <div>{unidad.vehiculo_placa}</div> : null}
            </Popup>
          </Marker>
        )}
        {incidentPos && (
          <Marker position={incidentPos} icon={incidentIcon}>
            <Popup>
              <strong>{alerta?.titulo}</strong>
              <div>{alerta?.direccion}</div>
            </Popup>
          </Marker>
        )}
        {route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: "#7c5cbf", weight: 5, opacity: 0.85 }} />
        )}
      </MapContainer>
      {etaLabel && (
        <div className="map-eta-chip">
          {etaLabel}
        </div>
      )}
    </div>
  );
}
