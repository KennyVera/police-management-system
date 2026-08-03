import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const unitIcon = (activo, selected) =>
  L.divIcon({
    className: `monitoreo-pin${selected ? " is-focused" : ""}`,
    html: `<span class="monitoreo-dot ${activo ? "busy" : "idle"}${selected ? " focused" : ""}"></span>`,
    iconSize: [selected ? 24 : 20, selected ? 24 : 20],
    iconAnchor: [selected ? 12 : 10, selected ? 12 : 10],
  });

const alertIcon = L.divIcon({
  className: "monitoreo-pin",
  html: '<span class="monitoreo-dot alert"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function direccionUnidad(u) {
  if (u?.alerta_activa?.direccion) {
    return u.alerta_activa.direccion;
  }
  const parts = [u?.sector_detalle, u?.cuadrante].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sin dirección registrada";
}

function FocusController({ focus, focusToken, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.latitud == null || focus?.longitud == null) return;
    const lat = Number(focus.latitud);
    const lng = Number(focus.longitud);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    map.setView([lat, lng], 16, { animate: true });
    const timer = setTimeout(() => {
      const marker = markerRefs.current[focus.id];
      if (marker) marker.openPopup();
    }, 280);
    return () => clearTimeout(timer);
  }, [map, focus, focusToken, markerRefs]);
  return null;
}

function FitBoundsOnce({ points, hasFocus }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (hasFocus || done.current || !points?.length) return;
    done.current = true;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [48, 48] });
  }, [map, points, hasFocus]);
  return null;
}

export default function MonitoreoMapa({ unidades, focus, focusToken = 0 }) {
  const markerRefs = useRef({});

  const unitMarkers = useMemo(
    () =>
      (unidades || [])
        .filter((u) => u.latitud != null && u.longitud != null)
        .map((u) => ({
          ...u,
          pos: [Number(u.latitud), Number(u.longitud)],
          busy: Boolean(u.alerta_activa),
          selected: focus?.id === u.id,
          direccion: direccionUnidad(u),
        })),
    [unidades, focus]
  );

  const alertMarkers = useMemo(
    () =>
      unitMarkers
        .filter((u) => u.alerta_activa?.latitud != null && u.alerta_activa?.longitud != null)
        .map((u) => ({
          id: u.alerta_activa.id,
          titulo: u.alerta_activa.titulo,
          direccion: u.alerta_activa.direccion,
          pos: [Number(u.alerta_activa.latitud), Number(u.alerta_activa.longitud)],
          agente: u.agente?.nombre,
        })),
    [unitMarkers]
  );

  const points = useMemo(
    () => [...unitMarkers.map((u) => u.pos), ...alertMarkers.map((a) => a.pos)],
    [unitMarkers, alertMarkers]
  );

  const center = points[0] || [-2.1709, -79.9224];
  const hasFocus = focus?.latitud != null && focus?.longitud != null;

  return (
    <div className="monitoreo-mapa-wrap">
      <MapContainer center={center} zoom={13} className="monitoreo-mapa" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce points={points} hasFocus={hasFocus} />
        <FocusController focus={focus} focusToken={focusToken} markerRefs={markerRefs} />
        {unitMarkers.map((u) => (
          <Marker
            key={`u-${u.id}`}
            position={u.pos}
            icon={unitIcon(u.busy, u.selected)}
            zIndexOffset={u.selected ? 1000 : 0}
            ref={(ref) => {
              if (ref) markerRefs.current[u.id] = ref;
              else delete markerRefs.current[u.id];
            }}
          >
            <Popup>
              <div className="monitoreo-popup">
                <strong>{u.unidad_label || "Unidad"}</strong>
                <p className="monitoreo-popup-line">
                  {u.agente?.nombre}
                  {u.companero?.nombre ? ` · ${u.companero.nombre}` : ""}
                </p>
                <p className="monitoreo-popup-line">
                  {u.vehiculo_placa}
                  {u.escuadra ? ` · ${u.escuadra}` : ""}
                </p>
                <p className="monitoreo-popup-dir">
                  <span aria-hidden>📍</span> {u.direccion}
                </p>
                <p className="monitoreo-popup-meta">
                  {Number(u.latitud).toFixed(5)}, {Number(u.longitud).toFixed(5)}
                </p>
                <p className="monitoreo-popup-status">
                  {u.alerta_activa
                    ? `En auxilio: ${u.alerta_activa.titulo} (${u.alerta_activa.estado_label})`
                    : "En patrullaje"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        {alertMarkers.map((a) => (
          <Marker key={`a-${a.id}`} position={a.pos} icon={alertIcon}>
            <Popup>
              <div className="monitoreo-popup">
                <strong>{a.titulo}</strong>
                <p className="monitoreo-popup-dir">
                  <span aria-hidden>📍</span> {a.direccion || "Sin dirección"}
                </p>
                <p className="monitoreo-popup-line">Asignado a {a.agente || "—"}</p>
              </div>
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
