import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const unitIcon = (activo) =>
  L.divIcon({
    className: "monitoreo-pin",
    html: `<span class="monitoreo-dot ${activo ? "busy" : "idle"}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const alertIcon = L.divIcon({
  className: "monitoreo-pin",
  html: '<span class="monitoreo-dot alert"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitOrFocus({ points, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.latitud != null && focus?.longitud != null) {
      map.setView([Number(focus.latitud), Number(focus.longitud)], 15, { animate: true });
      return;
    }
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [48, 48] });
  }, [map, points, focus]);
  return null;
}

export default function MonitoreoMapa({ unidades, focus }) {
  const unitMarkers = useMemo(
    () =>
      (unidades || [])
        .filter((u) => u.latitud != null && u.longitud != null)
        .map((u) => ({
          ...u,
          pos: [Number(u.latitud), Number(u.longitud)],
          busy: Boolean(u.alerta_activa),
        })),
    [unidades]
  );

  const alertMarkers = useMemo(
    () =>
      unitMarkers
        .filter((u) => u.alerta_activa?.latitud != null && u.alerta_activa?.longitud != null)
        .map((u) => ({
          id: u.alerta_activa.id,
          titulo: u.alerta_activa.titulo,
          pos: [Number(u.alerta_activa.latitud), Number(u.alerta_activa.longitud)],
          agente: u.agente?.nombre,
        })),
    [unitMarkers]
  );

  const points = useMemo(
    () => [...unitMarkers.map((u) => u.pos), ...alertMarkers.map((a) => a.pos)],
    [unitMarkers, alertMarkers]
  );

  const center = points[0] || [-0.1807, -78.4678];

  return (
    <div className="monitoreo-mapa-wrap">
      <MapContainer center={center} zoom={13} className="monitoreo-mapa" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitOrFocus points={points} focus={focus} />
        {unitMarkers.map((u) => (
          <Marker key={`u-${u.id}`} position={u.pos} icon={unitIcon(u.busy)}>
            <Popup>
              <strong>{u.unidad_label || "Unidad"}</strong>
              <br />
              {u.agente?.nombre}
              {u.companero?.nombre ? ` · ${u.companero.nombre}` : ""}
              <br />
              {u.vehiculo_placa} · {u.cuadrante}
              <br />
              {u.alerta_activa
                ? `En auxilio: ${u.alerta_activa.titulo} (${u.alerta_activa.estado_label})`
                : "En patrullaje"}
            </Popup>
          </Marker>
        ))}
        {alertMarkers.map((a) => (
          <Marker key={`a-${a.id}`} position={a.pos} icon={alertIcon}>
            <Popup>
              <strong>{a.titulo}</strong>
              <br />
              Asignado a {a.agente || "—"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="monitoreo-leyenda">
        <span>
          <i className="monitoreo-dot idle" /> Patrullaje
        </span>
        <span>
          <i className="monitoreo-dot busy" /> En auxilio
        </span>
        <span>
          <i className="monitoreo-dot alert" /> Incidente
        </span>
      </div>
    </div>
  );
}
